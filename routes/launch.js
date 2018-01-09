var express = require('express');
var router = express.Router();
var request = require('request');
//var parseXML = require('xml2js').parseString; no longer necessary with conversion back to JSON.
var fs = require("fs");
var beautify = require("vkbeautify");

//flow of views is launch (from first redirect) -> code (when we have access code) -> access (when we have access token).
// GET /launch?iss=https%3A%2F%2Fsb-fhir-dstu2.smarthealthit.org%2Fsmartdstu2%2Fdata&launch=Qk9g9o 200 1123.533 ms - 748
// POST /launch/auth 302 39.403 ms - 642
// GET /launch/code?code=SAs65J&state=123 200 32.805 ms - 304
// GET /launch/access?code=SAs65J&state=123 200 409.273 ms - 823

//so /launch/ -> /launch/auth upon button to get auth code -> redirect to /launch/code.
//from /launch/code, hit button to get access token -> /launch/access -> hit token endpoint -> display access page.
//Maybe at some point, use https://github.com/tjanczuk/iisnode to host on iis locally

const  glob = {}; //Defining global namespace so that we can use this for things like decoded ISS values and tokenURL. 
var config;

function authHeader(){
    //Auth header needs base64 encoding of clientId:clientSecret
    //Try also url encoding client ID + secret
    //toEncode = encodeURIComponent(clientId) + ":" + encodeURIComponent(clientSecret);
    var toEncode = glob.clientId + ":" + glob.clientSecret;
    //toEncode = encodeURIComponent(toEncode);// is this needed?
    var buff = new Buffer(toEncode);
    return buff.toString('base64');
}

if (process.env.NODE_ENV != "production"){
    var fileName = "../client.json";
    try {
        config = require(fileName); 
        glob.clientId = config.clientId;
        glob.clientSecret = config.clientSecret;
    } catch (error) {
        config = {};
        console.log("Unable to read file " + fileName);
    }
}

else {
    glob.clientId = process.env.clientId;
    glob.clientSecret = process.env.clientSecret;
}

router.get('/', function (req, res, next) { //Get request to /launch
    //decode iss parameter from query string, get launch token from query string.
    glob.decodeIss = decodeURIComponent(req.query.iss);
    glob.launch = req.query.launch;

    //Get the conformance statement from metadata endpoint
    //On completion, we call res.render to avoid getting errors that authURL isn't defined
    var st = new Date(); //perf testing
    request.get(glob.decodeIss + '/metadata', {headers: {'Accept': 'application/json'}}, function (error, response, body) {
        if (!error) {
            var jsonConformance = JSON.parse(body);
            //authURL.rest[0].security = location of oauth URIs
            glob.authUrl = jsonConformance.rest[0].security.extension[0].extension[0].valueUri;
            glob.tokenUrl = jsonConformance.rest[0].security.extension[0].extension[1].valueUri;
            
            //No longer necessary with header of Accept: application/json.
            //parseXML(body, function (err, result) {
            //    glob.authUrl = result.Conformance.rest[0].security[0].extension[0].extension[0].valueUri[0].$.value;
            //    glob.tokenUrl = result.Conformance.rest[0].security[0].extension[0].extension[1].valueUri[0].$.value;
            //    //console.log(result);
            //});

            var end = new Date(); //perf testing
            console.log("Request time: " + (end.getTime() - st.getTime()) + "ms"); //perf testing
            var vars = {
                    iss: glob.decodeIss,
                    launch: glob.launch,
                    auth_url: glob.authUrl,
                    token_url: glob.tokenUrl
                };
            res.render('launch', {"vars": vars, conformance: beautify.json(JSON.stringify(jsonConformance))});
        }
    });

});


//Called from button press after launch so that we can get the auth code
router.post('/auth', function (req, res, next) {
    if (process.env.NODE_ENV == "production") {
        glob.redirectURI = encodeURIComponent("https://" + req.headers.host + "/launch/code");
    }
    else {
        glob.redirectURI = encodeURIComponent("http://localhost:3000/launch/code");
    }
    var postUrl = glob.authUrl + "?redirect_uri=" + glob.redirectURI + "&response_type=code&scope=launch&state=123&launch=" + glob.launch + "&client_id=" + glob.clientId + "&aud=" + encodeURIComponent(glob.decodeIss);
    postUrl = postUrl.replace("\"","");
    res.redirect(postUrl);
});

//redirected to once we have the auth code
router.get('/code', function (req, res, next) {
    glob.authCode = req.query.code;
    var state = req.query.state;
    var vars = {
            client_id: glob.clientId,
            auth_code: glob.authCode,
            state: state
        };
    res.render('code', { "vars": vars});
});

//called once we hit the button to get access token -> makes the call to the token endpoint for us.
router.get('/access', function (req, res, next) {
    var state = req.query.state;

    var postConfig = {
        method: 'POST',
        url: glob.tokenUrl,
        body: "grant_type=authorization_code&code=" + glob.authCode + "&redirect_uri=" + glob.redirectURI,// + "&client_id=" + clientId + "&client_secret=" + clientSecret,
        headers: {
            'content-type': "application/x-www-form-urlencoded",
            Authorization: "Basic " + authHeader(),
        },
    }

    var post = request(postConfig, function (error, response, body) {
        if (!error) {
            // res.render('index');
            // res.send(body)
            // console.log(JSON.stringify(post, null, 4)); //debugging
            reqBod = JSON.parse(body);

            glob.access = reqBod.access_token;
            glob.refresh = reqBod.refresh_token;
            glob.patId = reqBod.patient

            var vars = {
                    access_token: glob.access,
                    token_type: reqBod.token_type,
                    refresh_token: glob.refresh,
                    patient_FHIR_id: glob.patId,
                    token_url: glob.tokenUrl,
                    postBody: postConfig.body
                };
            res.render('access', {"vars": vars, body: beautify.json(body) });
        }
    });

});

router.get('/refresh', function(req, res, next){
    //query token endpoint with refresh token etc. and then send that back to page.

    var req = {
        method: 'POST',
        url: glob.tokenUrl,
        body: "grant_type=refresh_token&refresh_token=" + glob.refresh + "&redirect_uri=" + glob.redirectURI,// + "&client_id=" + clientId + "&client_secret=" + clientSecret,
        headers: {
            'content-type': "application/x-www-form-urlencoded",
            Authorization: "Basic " + authHeader(),
        },
    }

    
    var post = request(req, function (error, response, body) {
        if (!error) {
            reqBod = JSON.parse(body);
            res.send({
                accessToken: reqBod.access_token,
                postBody: req.body
            });
        }
    });
});

router.get('/fhirrequest', function(req, res, next){

    var vars = {
        access_token: glob.access,
        launch_token: glob.launch,
        refresh_token: glob.refresh,
        patient_id: glob.patId,
        patUrl: "https://apporchard.epic.com/interconnect-ao83prd-oauth/api/FHIR/DSTU2/Patient/", 
        token_url:  glob.tokenUrl
    }

    res.render('fhirrequest', {
        "vars": vars 
    });
});

module.exports = router;
