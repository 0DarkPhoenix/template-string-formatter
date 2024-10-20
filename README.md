# Template String Formatter Plus

## Overview

The "Template String Formatter Plus" extension for Visual Studio Code is a customizable tool designed to enhance your JavaScript and TypeScript coding experience by automatically converting regular string literals into template strings when they contain curly braces. This ensures your code is more efficient and readable by leveraging JavaScript's template string formatting.

## Features

- **Automatic Conversion**: Detects and converts string literals with placeholders into template strings.
- **Ignore Patterns**: Customize which files should be ignored during the conversion process.
- **Real-time Updates**: Automatically updates strings as you type or modify your code.

## Usage

### Automatic Conversion

The extension automatically converts eligible string literals into template strings as you type. It checks for placeholders within strings and adds or removes the backtick (`) as needed.

### Configuration

You can configure the extension to ignore specific files or patterns by updating the settings:

- Open your VS Code settings.
- Search for `template-string-formatter-plus.ignorePatterns`.
- Add file patterns to the list to exclude them from automatic conversion (e.g. "\*route.js", "\*/tests/config/*").

## Extension Settings

This extension contributes the following settings:

- `template-string-formatter-plus.ignorePatterns`: Define file patterns to ignore when converting template strings (Default: `[]`).
- `template-string-formatter-plus.convertOnCurlyBraces`: Enable or disable conversion when curly braces are detected (Default: `true`).

## Known Issues

- The extension may not correctly identify strings within complex expressions or multiline strings. Ensure your strings are formatted correctly for best results.

## Repository

For more information, issues, or contributions, visit the [GitHub repository](https://github.com/0DarkPhoenix/template-string-formatter-plus).

## License

This extension is licensed under the MIT License.
