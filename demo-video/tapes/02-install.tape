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

# Let the first question be visible before first selection
Sleep 1200ms

# IDE → VS Code (pause to let viewer read the question)
Type "1"
Sleep 600ms
Enter
Sleep 1200ms

# CMS → None
Sleep 600ms
Type "4"
Sleep 600ms
Enter
Sleep 1200ms

# DB → Supabase
Sleep 600ms
Type "1"
Sleep 600ms
Enter
Sleep 1200ms

# PM → Linear
Sleep 600ms
Type "1"
Sleep 600ms
Enter
Sleep 1200ms

# Notifications → Slack
Sleep 600ms
Type "1"
Sleep 600ms
Enter

# Wait for output to finish and fill remaining audio time
Sleep 672ms
