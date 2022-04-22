const client = require('./persistent-client');

const egyClient = client({
    baseURL: 'https://jeny.egybest.fyi/',
    transformResponse: _ => _
});

const vidStreamClient = client({
    baseURL: 'https://vidstream.to/',
    transformResponse: _ => _
});

function getDownloadLinks(episodeLink) {
    const fileName = episodeLink.split('/').at(-1);

    const srcRegex = /auto-size" src="(.*?)"/g;
    const jsCodeRegex = /<script.*?>function \w+?\(\)\{(.+?)};<\/script/g;
    const sourceRegex = /(dostream.*?)"/g;

    const verificationTokenRegex = /\{'([0-9a-zA-Z_]*)':'ok'\}/g;
    const encodedAdLinkVarRegex = /\(([0-9a-zA-Z_]{2,12})\[Math/g;
    const encodingArraysRegex = /,([0-9a-zA-Z_]{2,12})=\[\]/g;

    return egyClient.get(episodeLink)
        .then(res => srcRegex.exec(res.data)[1])
        .then(src => 
            egyClient.get(src).then(({ data }) => {
                const sourceLink = sourceRegex.exec(data);
                if (sourceLink) return sourceLink[1];
                
                let jsCode = jsCodeRegex.exec(data)[1];
            
                const verificationToken = verificationTokenRegex.exec(jsCode)[1];
                const encodedAdLinkVar = encodedAdLinkVarRegex.exec(jsCode)[1];
                const [firstEncodingArrayName, secondEncodingArrayName] = [...jsCode.matchAll(encodingArraysRegex)].slice(1, 3).map(_ => _[1]);
            
                jsCode = jsCode.replace(/[;,]\$\('\*'\)(.*)$/g, ';');
                jsCode = jsCode.replace(/,ismob=(.*)\(navigator\[(.*)\]\)[,;]/g, ';');
                jsCode = jsCode.replace(/var a0b=function\(\)(.*)a0a\(\);/g, '');
                
                eval(jsCode);
            
                const firstEncodingArray = eval(firstEncodingArrayName), secondEncodingArray = eval(secondEncodingArrayName);
            
                const verificationPath = secondEncodingArray.reduce((prev, curr) => prev + (firstEncodingArray[curr] || ''), '');
                const encodedAdPath = eval(encodedAdLinkVar)[0];
                
                const toBeDecoded = encodedAdPath + '='.repeat(encodedAdPath.length % 4);
                
                const adLink = '/' + atob(toBeDecoded);
                const verificationLink = `/tvc.php?verify=${verificationPath}`;
            
                return egyClient.get(adLink)
                    .then(() =>
                        egyClient.post(verificationLink, {
                            [verificationToken]: 'ok'
                        })
                    )
                    .then(() => egyClient.get(src))
                    .then(_ => sourceRegex.exec(_.data)[1])
            })
            .then(m3uLink => vidStreamClient.get(m3uLink))
            .then(_ => _.data.split('\n').slice(1).filter(_ => _))
            .then(_ => {
                const accum = [];

                for (let i = 1; i < _.length; i += 2) {
                    const quality = Math.ceil(_[i - 1].split(',')[2].split('x')[1] / 10) * 10;
                    const fullFileName = `/${fileName}-${quality}p.mp4`;

                    const link = _[i].replace('/stream/', '/dl/').replace('/stream.m3u8', fullFileName);
                    
                    accum.push({
                        link,
                        quality
                    });
                }
                
                return accum;
            })
        );
}