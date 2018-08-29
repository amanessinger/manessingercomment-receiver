exports.handler = (event, context, callback) => {

    let incomingMsg = JSON.stringify(event);

    const path = require('path');
    let receivedHash = path.basename(event.attach_to);
    let fqname = path.dirname(event.attach_to);
    let secret = process.env.HUGO_SECRET;

    const crypto = require('crypto');

    // create SHA-256 hash of event
    let checksum = crypto.createHash('sha256');
    checksum.update(secret+fqname);
    let checkHash = checksum.digest('hex');

    if (checkHash !== receivedHash) {
        console.log('fqname       = '+fqname);
        console.log('secret       = '+secret);
        console.log('combined     = '+secret+fqname);
        console.log('receivedHash = '+receivedHash);
        console.log('checkHash    = '+checkHash);
        var responseBody = {
            "status": "bad request",
            "description": "not accepted"
        };
        sendResponse(callback, 400, responseBody);
    }

    // create SHA-256 hash of event
    let eventsum = crypto.createHash('sha256');
    eventsum.update(incomingMsg);
    let deduplicationId = eventsum.digest('hex');

    // Load the AWS SDK for Node.js
    var AWS = require('aws-sdk');
    // Set the region
    AWS.config.update({ region: 'us-east-2' });
    // Create an SQS service object
    var sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
    var params = {
        MessageBody: incomingMsg,
        QueueUrl: "https://sqs.us-east-2.amazonaws.com/583491089160/manessingercomcomments.fifo",
        MessageDeduplicationId: deduplicationId,
        MessageGroupId: "comment"
    };
    sqs.sendMessage(params, function(err, data) {
        if (err) {
            var responseBody = {
                "status": "error",
                "description": "delivering to SQS failed"
            };
            sendResponse(callback, 500, responseBody);
        }
        else {
            var responseBody = {
                "status": "accepted",
                "id": data.MessageId,
            };
            sendResponse(callback, 200, responseBody);
        }
    });
};

function sendResponse(callback, status, body) {
    var response = {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
        },
        "body": JSON.stringify(body),
        "isBase64Encoded": false
    };
    callback(null, response);
}
