
const AWS = require('aws-sdk');
const http = require('http');
const request = require('request');
const S3 = new AWS.S3();

require('node-env-file')('.env');

exports.handler = function(event, context) {

    bucket = process.env.BUCKET;
    sites = process.env.SITES.split(',');

    event['time'] = new Date(event['time']);

    console.log('Sites: ', sites);
    console.log('Types: ', types);
    console.log('Time:  ', event['time']);
};

exports.getImageURLs = function(site, type, datetime) {
    var duration = 12;
    var imageListURL = `http://climate.weather.gc.ca/radar/index_e.html?site=${site}&year=${datetime.getFullYear()}&month=${datetime.getMonth()}&day=${datetime.getDate()}&hour=${datetime.getHours()}&minute=${datetime.getMinutes()}&duration=${duration}&image_type=${type}`

    return new Promise((resolve, reject) => {
        request(imageListURL, (error, response, body) => {
            if(error) reject(error);
            else if(body.indexOf('blobArray')<0) reject("Image type not available at specified time");
            else if(response.statusCode !== 200) reject("Unsuccessful response from server");
            else if(!error && response.statusCode == 200) {
                var re = /^\s*blobArray = \[([\s\S]*)\],$/gm;
                var blobArray = re.exec(body)[1]
                    .split('\n')
                    .filter((s) => { return !s.match(/^\s+$/); })
                    .map((s) => { return /s*'(.*)',/.exec(s)[1]; })
                    .map((url) => { return {type: type, image: url}; })
                resolve(blobArray);
            }
        });
    });
};

exports.processSite = function(site, datetime) {
    var morning = new Date(datetime);
    morning.setHours(0);
    var evening = new Date(datetime);
    evening.setHours(12);

    var types = process.env.TYPES.split(',');
    return Promise.all(types.map(function(type) {
        return Promise.all([
            exports.getImageURLs(site, type, morning),
            exports.getImageURLs(site, type, evening),
        ]);
    }));
};

exports.transferImage = function(image_url, bucket, filename) {
    var image_url = `http://climate.weather.gc.ca${image_url}`;
    return new Promise((resolve, reject) => {
        request(image_url, (error, response, body) => {
            S3.putObject({
                Bucket: bucket,
                Key: filename,
                Body: body
            }, (err, data) => {
                if(err) reject(err);
                else resolve(data);
            });
        });
    });
};
