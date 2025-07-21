# Scratchpad: Issue #22 - Clean up main directory

**Issue Link:** https://github.com/[repo]/issues/22

## Problem Analysis
The main directory has accumulated various development artifacts, test files, and documentation that should be organized or removed to maintain a clean project structure.

## Current Directory Assessment
Confirmed the following files exist and match the issue description:

### Files to Remove (Development Artifacts & Documentation)
✅ Confirmed present:
- ADMIN_AVATAR_DEBUG.md
- ADMIN_IMAGE_MANAGEMENT_COMPLETE.md
- ADMIN_NOTIFICATION_SYSTEM.md
- AUTHENTICATION_SETUP.md
- BLUE_BUTTON_COLOR_UPDATE.md
- CHARACTER_CREATION_FIXES.md
- CHARACTER_CREATION_README.md
- COMPLETE_LOCALIZATION_UPDATE.md
- CREATE_CHARACTER_BUTTON_UPDATE.md
- DARK_THEME_FIXES.md
- FIREBASE_SETUP.md
- IMAGE_DISPLAY_FIX.md
- IMAGE_MANAGEMENT_GUIDE.md
- NOTIFICATION_SYSTEM_SUMMARY.md
- PATH_VERIFICATION.md
- PAYMENT_SETUP.md
- PURPLE_TO_BLUE_COLOR_UPDATE.md
- THREE_ISSUES_FIXED.md
- TOKEN_BUTTON_STYLE_IMPROVEMENTS.md
- TOKEN_INTERFACE_IMPROVEMENTS.md
- login-page-improvements.md
- scratchpad-issue-16-email-auth.md
- scratchpad-issue-18-login-chinese-ui.md
- scratchpad-issue-6-payment-system.md

### Test/Demo Files to Remove
✅ Confirmed present:
- chat_demo.png
- geminiyong_chat_demo(gemini).py
- global_dataset.csv
- test_character_creation.py

### Directories to Evaluate
✅ Confirmed present:
- web_demo/ - Need to check if still needed or can be removed
- logs/ - Contains MCP puppeteer logs, should be in .gitignore

## Implementation Plan

### Phase 1: Safety Checks
1. Search codebase for any references to files before removal
2. Check if any documentation files contain important information that should be preserved
3. Evaluate web_demo directory contents

### Phase 2: File Removal
1. Remove all markdown documentation files listed above
2. Remove test/demo files
3. Remove scratchpad files (since this is now the main scratchpad for cleanup)

### Phase 3: Directory Cleanup
1. Evaluate web_demo directory - likely safe to remove as it appears to be a duplicate setup
2. Keep logs/ but add to .gitignore

### Phase 4: .gitignore Updates
1. Add patterns to prevent future accumulation:
   - *.md (except README.md and CLAUDE.md)
   - logs/
   - scratchpad-*
   - *_demo.*
   - test_*.py (in root)

### Phase 5: Verification
1. Ensure essential files remain (README.md, CLAUDE.md, package.json, etc.)
2. Run development server to ensure nothing breaks
3. Test basic functionality with puppeteer

## Risk Assessment
- Low risk: Most files are documentation and temporary artifacts
- Medium risk: web_demo directory (need to verify if it's actually used)
- Files to preserve: README.md, CLAUDE.md, package.json, package-lock.json, tsconfig.json, etc.

## Implementation Steps
1. Create branch: `cleanup/issue-22-clean-main-directory`
2. Run safety checks and searches
3. Remove files in batches with descriptive commits
4. Update .gitignore
5. Test changes
6. Create PR

## Expected Outcome
Clean root directory with only essential project files:
- README.md, CLAUDE.md
- package.json, package-lock.json
- Configuration files (tsconfig.json, vite.config.ts, etc.)
- Project directories (client/, backend/, attached_assets/)
- Essential tooling configs (components.json, etc.)