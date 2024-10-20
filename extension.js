const vscode = require("vscode");

function activate(context) {
	let activeEditor = vscode.window.activeTextEditor;
	let timeout = undefined;
	let config = vscode.workspace.getConfiguration("template-string-formatter-plus");
	let ignorePatterns = config.get("ignorePatterns", []);
	let convertOnCurlyBraces = config.get("convertOnCurlyBraces", true);

	function shouldIgnoreFile(filePath) {
		return ignorePatterns.some((pattern) => {
			const adjustedPattern = pattern.endsWith("$") ? pattern : `${pattern}$`;
			return new RegExp(adjustedPattern).test(filePath);
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

		const filePath = document.fileName;

		if (shouldIgnoreFile(filePath)) {
			return;
		}

		const position = activeEditor.selection.active;
		const lineText = document.lineAt(position.line).text;
		const stringRegex = /(`|"|')((?:\\\1|.)*?)\1/g;
		let match;

		while ((match = stringRegex.exec(lineText)) !== null) {
			const [stringContent, quoteType] = match;
			const start = match.index;
			const end = stringRegex.lastIndex;

			if (position.character >= start && position.character <= end) {
				const hasPlaceholders = /\$\{.*?\}/.test(stringContent);
				const hasCurlyBraces = /\{[^}]*\}/.test(stringContent);
				const hasUnprefixedCurlyBraces = /[^$]\{[^}]*\}/.test(stringContent);

				const shouldConvertToTemplate =
					(hasPlaceholders || (convertOnCurlyBraces && hasCurlyBraces)) &&
					quoteType !== "`";
				const shouldConvertFromTemplate =
					quoteType === "`" && (hasUnprefixedCurlyBraces || !hasPlaceholders);

				if (shouldConvertToTemplate || shouldConvertFromTemplate) {
					activeEditor.edit(
						(editBuilder) => {
							let newContent = stringContent.slice(1, -1);
							const newQuotes = shouldConvertToTemplate ? "`" : '"';
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
			break;
		}
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