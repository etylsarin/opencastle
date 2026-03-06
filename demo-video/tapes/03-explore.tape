# Scene 3: Explore generated files
Output clips/03-explore.mp4
Set FontSize 16
Set Width 1280
Set Height 720
Set Theme "Catppuccin Mocha"
Set TypingSpeed 40ms
Set Padding 16
Set Framerate 30
Set Shell "bash"
Set WindowBar Colorful
Set FontSize 14

Hide
Type "cd /tmp/opencastle-demo && export PS1='$ ' && clear"
Enter
Sleep 500ms
Show

Sleep 500ms
Type "find .github -maxdepth 2 -type d ! -path '.github/skills/*' ! -path '.github/plugins/*' | sort"
Enter

Sleep 16456ms
