const { promises: {readFile} } = require('fs');
const pres = require('./persistent-client');

const client = pres({
    baseURL: 'https://jeny.egybest.fyi/',
    transformResponse: _ => _
});

const srcRegex = /auto-size" src="(.*?)"/g;
const jsCodeRegex = /<script.*?>(.+?)<\/script/g;
const verificationTokenRegex = /\{'([0-9a-zA-Z_]*)':'ok'\}/g;
const encodedAdLinkVarRegex = /\(([0-9a-zA-Z_]{2,12})\[Math/g;
const encodingArraysRegex = /,([0-9a-zA-Z_]{2,12})=\[\]/g;

/* client.get('/episode/vikings-season-2-ep-2').then(res => {
    const src = srcRegex.exec(res.data)[1];
    return client.get(src);
}).then(_ => _.data) */

readFile('./html2').then(_ => _.toString())
.then(data => {
    let jsCode = [...data.matchAll(jsCodeRegex)][1][1];

    const verificationToken = verificationTokenRegex.exec(jsCode)[1];
    const encodedAdLinkVar = encodedAdLinkVarRegex.exec(jsCode)[1];
    const [, firstEncodingArray, secondEncodingArray] = [...jsCode.matchAll(encodingArraysRegex)].map(_ => _[1]);

    jsCode = jsCode.replace(/[;,]\$\('\*'\)(.*)$/g, ';');
    jsCode = jsCode.replace(/,ismob=(.*)\(navigator\[(.*)\]\)[,;]/g, ';');
    jsCode = jsCode.replace(/var a0b=function\(\)(.*)a0a\(\);/g, '');
    jsCode += `var link = ''; for (var i = 0; i <= ${secondEncodingArray}['length']; i++) { link += ${firstEncodingArray}[${secondEncodingArray}[i]] || ''; }; return [link, ${encodedAdLinkVar}[0]] }; xrqtapfYn();`;

    const [verificationPath, encodedAdPath] = eval(jsCode);

    debugger;
});