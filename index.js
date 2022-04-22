const { promises: {readFile} } = require('fs');
const pres = require('./persistent-client');

const egyClient = pres({
    baseURL: 'https://jeny.egybest.fyi/',
    transformResponse: _ => _
});

const vidStreamClient = pres({
    baseURL: 'https://vidstream.to/',
    transformResponse: _ => _
})

const srcRegex = /auto-size" src="(.*?)"/g;
const jsCodeRegex = /<script.*?>function \w+?\(\)\{(.+?)};<\/script/g;
const sourceRegex = /(dostream.*?)"/g;

const verificationTokenRegex = /\{'([0-9a-zA-Z_]*)':'ok'\}/g;
const encodedAdLinkVarRegex = /\(([0-9a-zA-Z_]{2,12})\[Math/g;
const encodingArraysRegex = /,([0-9a-zA-Z_]{2,12})=\[\]/g;

egyClient.get('/episode/vikings-season-2-ep-2')
.then(res => srcRegex.exec(res.data)[1])
.then(src => {
    egyClient.get(src).then(({ data }) => {
        let jsCode = jsCodeRegex.exec(data)[1];
    
        const verificationToken = verificationTokenRegex.exec(jsCode)[1];
        const encodedAdLinkVar = encodedAdLinkVarRegex.exec(jsCode)[1];
        const [, firstEncodingArrayName, secondEncodingArrayName] = [...jsCode.matchAll(encodingArraysRegex)].map(_ => _[1]);
    
        jsCode = jsCode.replace(/[;,]\$\('\*'\)(.*)$/g, ';');
        jsCode = jsCode.replace(/,ismob=(.*)\(navigator\[(.*)\]\)[,;]/g, ';');
        jsCode = jsCode.replace(/var a0b=function\(\)(.*)a0a\(\);/g, '');
        
        eval(jsCode);
    
        const firstEncodingArray = eval(firstEncodingArrayName);
        const secondEncodingArray = eval(secondEncodingArrayName);
    
        const verificationPath = secondEncodingArray.reduce((prev, curr) => prev + (firstEncodingArray[curr] || ''), '');
        const encodedAdPath = eval(encodedAdLinkVar)[0];
        
        const toBeDecoded = encodedAdPath + '='.repeat(encodedAdPath.length % 4);
        
        const adLink = '/' + atob(toBeDecoded);
        const verificationLink = `/tvc.php?verify=${verificationPath}`;
    
        return Promise.all([
            egyClient.get(adLink),
            egyClient.post(verificationLink, {
                [verificationToken]: 'ok'
            })
        ]);
    })
    .then(() => egyClient.get(src))
    .then(idk => sourceRegex.exec(idk.data)[1])
    .then(m3uLink => vidStreamClient.get(m3uLink))
    .then(links => {
        debugger;
    })
});