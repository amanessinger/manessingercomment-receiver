exports.handler = (event, context, callback) => {

    let incomingMsg = JSON.stringify(event);

    // create SHA1 hash of event
    var crypto = require('crypto'), shasum = crypto.createHash('sha1');
    shasum.update(incomingMsg);
    let deduplicationId = shasum.digest('hex');

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
