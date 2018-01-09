//add code to hide <details> element on pages on click.

function hidePre(){
    if((navigator.userAgent.indexOf("Trident/") > 0)){
        var pre = document.getElementsByTagName("pre")[0];
        if (pre.style.visibility == "hidden"){
            pre.style.visibility = "visible";
        }
        else{
            pre.style.visibility = "hidden";
        }
    }
    else{
        return;
    }
}