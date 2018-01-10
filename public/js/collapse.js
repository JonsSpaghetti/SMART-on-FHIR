//add code to hide <details> element on pages on click for IE only.

function hidePre(){
    if((navigator.userAgent.indexOf("Trident/") > 0)){
        var pre = document.getElementsByTagName("pre")[0];
        pre.style.display = (pre.style.display == "") ? "None" : "";
    }
    else{
        return;
    }
}