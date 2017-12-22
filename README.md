## SMART on FHIR launch flow sample app for learning purposes.
#Now hosted at https://damp-river-36466.herokuapp.com/
#specify the launch endpoint in any EMR launch tester as https://damp-river-36466.herokuapp.com/launch

# SMART-on-FHIR
1. Get a client ID and secret and set app as confidential with EMR vendor
2. Put your client ID and secret into a client.json file in the root folder.
3. Set your launch URI to http://localhost:3000/launch
4. Set your redirect URI to http://localhost:3000/launch/code
5. npm start
6. Hit the buttons as they show up and see what is getting passed around during the OAuth2 workflow.

Format of client.json:
{
    "clientId" : "client ID",
    "clientSecret" : "client secret"
}

# OAuth2 flow

## Express server output:
* GET /launch?iss=https%3A%2F%2Fsb-fhir-dstu2.smarthealthit.org%2Fsmartdstu2%2Fdata&launch=Qk9g9o 200 1123.533 ms - 748
* POST /launch/auth 302 39.403 ms - 642
* GET /launch/code?code=SAs65J&state=123 200 32.805 ms - 304
* GET /launch/access?code=SAs65J&state=123 200 409.273 ms - 823

## Steps:
1. Launch via EMR/sandbox
    * Land on the /launch page.
    * Query string parameter for iss will be FHIR base URL
    * Query string parameter for launch will be launch token
2. Hit button to exchange launch token for authorization code
    * GET to iss/metadata endpoint to get OAuth auth/token URLs.
    * POST to /launch/auth endpoint with launch token to get authorization code.
    * Redirect will land you on /launch/code page.
        * Access code will be in the code query string parameter.
3. Hit button to get access token
    * GET to /launch/access endpoint will in turn POST to token endpoint.
        * Authorization header using Basic auth + base64 encoded combination of clientID:clientSecret.
4. Land on /launch/access page with access token on page.
