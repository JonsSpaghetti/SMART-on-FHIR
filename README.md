# SMART-on-FHIR
1. Get a client ID and secret and set app as confidential with EMR vendor
2. Put your client ID and secret into a client.json file in the root folder.
3. Set your launch URI to http://localhost:3000/launch
4. Set your redirect URI to http://localhost:3000/launch/code
5. npm start
6. Hit the buttons as they show up and see what is getting passed around during the OAuth2 workflow.