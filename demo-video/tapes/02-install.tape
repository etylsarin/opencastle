# Scene 2: Install
Output clips/02-install.mp4
Set FontSize 16
Set Width 1280
Set Height 720
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set Padding 16
Set Framerate 30
Set Shell "bash"
Set WindowBar Colorful

Hide
Type "cd /tmp/opencastle-demo && rm -rf .github .vscode .gitignore .opencastle.json 2>/dev/null; export PS1='$ ' && clear"
Enter
Sleep 500ms
Show

Sleep 500ms
Type "npx opencastle init"
Enter
Sleep 2200ms

# Wait for repo scanning and IDE question to appear
Sleep 1500ms

# ── IDEs (multiselect: ↑/↓ navigate, Space toggle, Enter confirm) ──
# Cursor starts on VS Code — toggle it on
Space
Sleep 600ms
Enter
Sleep 1200ms

# ── Tech Tools (multiselect) ─────────────────────────────────────────
# Chrome DevTools is pre-selected. Navigate to Supabase (4th item).
Sleep 800ms
Down
Sleep 300ms
Down
Sleep 300ms
Down
Sleep 300ms
Space
Sleep 600ms
Enter
Sleep 1200ms

# ── Team Tools (multiselect) ─────────────────────────────────────────
# Toggle Linear (1st item, cursor already there)
Sleep 800ms
Space
Sleep 300ms
# Navigate down to Slack (3rd item)
Down
Sleep 300ms
Down
Sleep 300ms
# Toggle Slack
Space
Sleep 600ms
Enter

# Wait for output to finish and fill remaining audio time
Sleep 2672ms
