const vscode = require("vscode");

function activate(context) {
	let activeEditor = vscode.window.activeTextEditor;
	let timeout = undefined;
	let config = vscode.workspace.getConfiguration("template-string-formatter-plus");
	let ignorePatterns = config.get("ignorePatterns", []);
	let convertOnCurlyBraces = config.get("convertOnCurlyBraces", true);

	function shouldIgnoreFile(filePath) {
		const normalizedPath = filePath.replace(/\\/g, "/");

		return ignorePatterns.some((pattern) => {
			// Convert glob-style pattern to RegExp
			const regexPattern = pattern
				.replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special RegExp chars except *
				.replace(/\*/g, ".*"); // Convert * to .* for wildcards

			return new RegExp(`^${regexPattern}$`).test(normalizedPath);
		});
	}

	function updateTemplateString() {
		if (!activeEditor) {
			return;
		}

		const document = activeEditor.document;
		const supportedLanguages = [
			"javascript",
			"typescript",
			"javascriptreact",
			"typescriptreact",
		];

		if (!supportedLanguages.includes(document.languageId)) {
			return;
		}

		// Return early when the file path matches one of the ignore patterns
		const filePath = document.fileName;
		if (shouldIgnoreFile(filePath)) {
			return;
		}

		const position = activeEditor.selection.active;
		const lineText = document.lineAt(position.line).text;

		// Check if current position is within a comment
		const isInComment = isPositionInComment(document, position);
		if (isInComment) {
			return;
		}

		const stringRegex = /(`|"|')((?:[^\\]|\\.)*?)\1/g;
		let match;

		while ((match = stringRegex.exec(lineText)) !== null) {
			const fullMatch = match[0];
			const quoteType = match[1];
			const start = match.index;
			const end = match.index + fullMatch.length;

			if (position.character >= start && position.character <= end) {
				const stringContent = fullMatch.slice(1, -1);

				// Skip empty strings or strings with only whitespace
				if (quoteType === "`" && stringContent.trim() === "") {
					continue;
				}

				const hasPlaceholders = /\$\{.*?\}/.test(stringContent);
				const hasCurlyBraces = /\{[^}]*\}/.test(stringContent);
				const hasUnprefixedCurlyBraces = /[^$]\{[^}]*\}/.test(stringContent);

				// Check if the backtick is preceded by a function name (tagged template literal)
				const isTaggedTemplateLiteral =
					quoteType === "`" &&
					start > 0 &&
					/[a-zA-Z0-9_$]\s*$/.test(lineText.substring(0, start));

				// Check if the string contains line breaks
				const hasLineBreaks = stringContent.includes("\n");

				const shouldConvertToTemplate =
					(hasPlaceholders || (convertOnCurlyBraces && hasCurlyBraces)) &&
					quoteType !== "`";
				const shouldConvertFromTemplate =
					quoteType === "`" &&
					(hasUnprefixedCurlyBraces || !hasPlaceholders) &&
					!isTaggedTemplateLiteral &&
					!hasLineBreaks;

				if (shouldConvertToTemplate || shouldConvertFromTemplate) {
					activeEditor.edit(
						(editBuilder) => {
							let newContent = stringContent;
							const newQuotes = shouldConvertToTemplate ? "`" : "'";
							let cursorOffset = 0;

							if (shouldConvertToTemplate && convertOnCurlyBraces) {
								newContent = newContent.replace(
									/(\$?)\{([^}]*)\}/g,
									(match, dollar, p1, offset) => {
										if (offset < position.character - start - 1) {
											cursorOffset += dollar ? 2 : 1;
										}
										return dollar ? match : `\${${p1}}`;
									},
								);
							} else if (shouldConvertFromTemplate) {
								newContent = newContent.replace(/\$\{([^}]*)\}/g, "{$1}");
							}

							editBuilder.replace(
								new vscode.Range(
									new vscode.Position(position.line, start),
									new vscode.Position(position.line, end),
								),
								`${newQuotes}${newContent}${newQuotes}`,
							);

							const newPosition = new vscode.Position(
								position.line,
								position.character + cursorOffset,
							);
							activeEditor.selection = new vscode.Selection(newPosition, newPosition);
						},
						{ undoStopBefore: false, undoStopAfter: false },
					);
				}
			}
		}
	}

	function isPositionInComment(document, position) {
		const lineText = document.lineAt(position.line).text;
		const lineUntilPosition = lineText.substring(0, position.character);

		// Check if in a single-line comment
		const singleLineCommentIndex = lineUntilPosition.lastIndexOf("//");
		if (singleLineCommentIndex >= 0 && !isInsideString(lineText, singleLineCommentIndex)) {
			return true;
		}

		// For multi-line comments, we'll scan from the beginning of the file or a reasonable limit
		const startLine = Math.max(0, position.line - 100);
		let inComment = false;

		// First scan backwards to find open/close comment markers
		for (let i = startLine; i <= position.line; i++) {
			const currentLine = document.lineAt(i).text;

			// For the current line, only scan up to the current position
			const textToScan = i === position.line ? lineUntilPosition : currentLine;

			let j = 0;
			while (j < textToScan.length - 1) {
				// Check for comment opening
				if (
					!inComment &&
					textToScan.substring(j, j + 2) === "/*" &&
					!isInsideString(textToScan.substring(0, j + 2), j)
				) {
					inComment = true;
					j += 2;
					continue;
				}

				// Check for comment closing
				if (
					inComment &&
					textToScan.substring(j, j + 2) === "*/" &&
					!isInsideString(textToScan.substring(0, j + 2), j)
				) {
					inComment = false;
					j += 2;
					continue;
				}

				j++;
			}
		}

		return inComment;
	}

	// Helper function to check if a position is inside a string
	function isInsideString(lineText, index) {
		let inSingleQuote = false;
		let inDoubleQuote = false;
		let inBacktick = false;
		let i = 0;

		while (i < index) {
			if (lineText[i] === "'" && (i === 0 || lineText[i - 1] !== "\\")) {
				inSingleQuote = !inSingleQuote;
			} else if (lineText[i] === '"' && (i === 0 || lineText[i - 1] !== "\\")) {
				inDoubleQuote = !inDoubleQuote;
			} else if (lineText[i] === "`" && (i === 0 || lineText[i - 1] !== "\\")) {
				inBacktick = !inBacktick;
			}
			i++;
		}

		return inSingleQuote || inDoubleQuote || inBacktick;
	}
	function triggerUpdateTemplateString() {
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(updateTemplateString, 5);
	}

	if (activeEditor) {
		triggerUpdateTemplateString();
	}

	vscode.window.onDidChangeActiveTextEditor(
		(editor) => {
			activeEditor = editor;
			if (editor) {
				triggerUpdateTemplateString();
			}
		},
		null,
		context.subscriptions,
	);

	vscode.workspace.onDidChangeTextDocument(
		(event) => {
			if (activeEditor && event.document === activeEditor.document) {
				triggerUpdateTemplateString();
			}
		},
		null,
		context.subscriptions,
	);

	vscode.workspace.onDidChangeConfiguration(
		(event) => {
			if (event.affectsConfiguration("template-string-formatter-plus")) {
				config = vscode.workspace.getConfiguration("template-string-formatter-plus");
				ignorePatterns = config.get("ignorePatterns", []);
				convertOnCurlyBraces = config.get("convertOnCurlyBraces", true);
			}
		},
		null,
		context.subscriptions,
	);
}

module.exports = {
	activate,
};
