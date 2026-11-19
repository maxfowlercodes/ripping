' Runs the Reelkit engine without a console window and opens the app window.
Set sh = CreateObject("WScript.Shell")
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\.."
sh.CurrentDirectory = root
sh.Run "cmd /c node bin\reelkit.mjs dashboard --open", 0, False
