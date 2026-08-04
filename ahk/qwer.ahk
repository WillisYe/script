#Requires Autohotkey v2

running := false
stopFlag := false

^!Q:: {
    global running, stopFlag
    if running
        return
    running := true
    stopFlag := false

    while !stopFlag {
        Send "{q}{w}{e}{r}"
        Sleep 300
    }

    running := false
}

^!W:: {
    global stopFlag
    stopFlag := true
}