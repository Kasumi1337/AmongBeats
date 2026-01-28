var pfp_count = 1;

function changePfpLeft() {
    if (pfp_count > 1)
        pfp_count -= 1;
    else
        pfp_count = 7;
    document.getElementById("pp").src = `./assets/icons/icon${pfp_count}.svg`
}

function changePfpRight() {
    if (pfp_count < 7)
        pfp_count += 1;
    else
        pfp_count = 1;
    document.getElementById("pp").src = `./assets/icons/icon${pfp_count}.svg`
}
