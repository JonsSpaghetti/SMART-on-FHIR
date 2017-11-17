var express = require('express');
var router = express.Router();
var request = require('request');
var parseXML = require('xml2js').parseString;
var fs = require("fs");

//flow of views is launch (from first redirect) -> code (when we have access code) -> access (when we have access token).
// GET /launch?iss=https%3A%2F%2Fsb-fhir-dstu2.smarthealthit.org%2Fsmartdstu2%2Fdata&launch=Qk9g9o 200 1123.533 ms - 748
// POST /launch/auth 302 39.403 ms - 642
// GET /launch/code?code=SAs65J&state=123 200 32.805 ms - 304
// GET /launch/access?code=SAs65J&state=123 200 409.273 ms - 823

//so /launch/ -> /launch/auth upon button to get auth code -> redirect to /launch/code.
//from /launch/code, hit button to get access token -> /launch/access -> hit token endpoint -> display access page.

var fileName = "../client.json"
var config

try {
   config = require(fileName); 
} catch (error) {
   config = {}
   console.log("Unable to read file " + fileName);
}

clientId = config.clientId
clientSecret = config.clientSecret

router.get('/', function(req, res, next){ //Get request to /launch
    //decode iss parameter from query string, get launch token from query string.
    decodeIss = decodeURIComponent(req.query.iss); 
    launch = req.query.launch;
    //for testing purposes
    // arr = decodeIss.split('/');
    // arr.pop();
    // decodeIss = arr.join('/');

    //Get the conformance statement from metadata endpoint
    //On completion, we call res.render to avoid getting errors that authURL isn't defined
    request.get(decodeIss + '/metadata', {}, function(error, response, body){
        if (!error){
            parseXML(body, function(err, result){
                authUrl = result.Conformance.rest[0].security[0].extension[0].extension[0].valueUri[0].$.value;
                tokenUrl = result.Conformance.rest[0].security[0].extension[0].extension[1].valueUri[0].$.value;
                //console.log(result);
            });
            // Not used with Epic sandbox.
            // authUrl = JSON.parse(body);
            // //authURL.rest[0].security = location of oauth URIs
            // authUrl = authUrl.rest[0].security.extension[0];

            res.render('launch', {
                iss: decodeIss,
                launch: launch,
                path: req.path,
                auth: authUrl,
                token: tokenUrl,
            });
        }
    });
    
});


//Called from button press after launch so that we can get the auth code
router.post('/auth', function(req, res, next){
    authUrl = req.body.authUrl;
    launchToken = req.body.launch;
    tokenUrl = req.body.token;
    redirectURI = encodeURIComponent("http://localhost:3000/launch/code")
    postUrl = authUrl + "?redirect_uri=" + redirectURI + "&response_type=code&scope=launch&state=123&launch=" + launchToken + "&client_id=" + clientId + "&aud=" + encodeURIComponent(decodeIss) 
    postUrl = postUrl.replace("\"","");
    res.redirect(postUrl);
/*     request.post(postUrl, {}, function(error, response, body){
        console.log(postUrl);
        if(!error){
            res.send(response.stringify); 
        }
    }); */
});

//redirected to once we have the auth code
router.get('/code', function(req, res, next){
    authCode = req.query.code;
    state = req.query.state;
    res.render('code', {
        clientId: clientId,
        authCode: authCode,
        state: state,
    });
});

//called once we hit the button to get access token -> makes the call to the token endpoint for us.
router.get('/access', function(req, res, next){
    authCode = req.query.code;
    state = req.query.state;

    //Auth header needs base64 encoding of clientId:clientSecret
    //Try also url encoding client ID + secret
    //toEncode = encodeURIComponent(clientId) + ":" + encodeURIComponent(clientSecret);
    toEncode = clientId + ":" + clientSecret;
    //toEncode = encodeURIComponent(toEncode);// is this needed?
    buff = new Buffer(toEncode);
    authHeader = buff.toString('base64');

    postConfig = {
       method: 'POST',
       url: tokenUrl,
       body: "grant_type=authorization_code&code=" + authCode + "&redirect_uri=" + redirectURI,// + "&client_id=" + clientId + "&client_secret=" + clientSecret,
       headers: {'content-type': "application/x-www-form-urlencoded",
            Authorization: "Basic " + authHeader,
       },
    }

    post = request(postConfig, function(error, response, body){
        if(!error){
            // res.render('index');
            // res.send(body)
            console.log(JSON.stringify(post, null, 4))
            reqBod = JSON.parse(body);
            res.render('access', {
                token: reqBod.access_token,
                token_type: reqBod.token_type,
                scope: reqBod.scope,
                patient: reqBod.patient,
                body: JSON.stringify(body)
            })
        }
    });    

});

module.exports = router;