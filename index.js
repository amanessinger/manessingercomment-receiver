exports.handler = (event, context, callback) => {

    const secret = process.env.HUGO_SECRET;
    const emailReceiver = process.env.EMAIL_RECEIVER;

    const crypto = require('crypto');

    let body = JSON.parse(event.body);
    const fqname = checkOriginOrFail(body, crypto, secret, callback);

    // modify data
    body.date = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');  // add timestamp (UTC)
    body.attach_to = fqname;                                                     // drop verification code

    // Load the AWS SDK for Node.js
    const AWS = require('aws-sdk');

    // Set the region
    AWS.config.update({ region: 'us-east-2' });
    // Create an SQS service object
    const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

    const incomingMsg = JSON.stringify(body);
    // console.log(incomingMsg);

    // create SHA-256 hash of event
    let eventsum = crypto.createHash('sha256');
    eventsum.update(incomingMsg);
    const deduplicationId = eventsum.digest('hex');

    const sqsParams = {
        MessageBody: incomingMsg,
        QueueUrl: "https://sqs.us-east-2.amazonaws.com/583491089160/manessingercomcomments.fifo",
        MessageDeduplicationId: deduplicationId,
        MessageGroupId: "comment"
    };
    sqs.sendMessage(sqsParams, function(err, data) {

        if (err) {
            const responseBody = {
                "status": "error",
                "description": "delivering to SQS failed"
            };
            sendResponse(callback, 500, responseBody);
        }

        // so far success; carry on sending email with SES
        sendEmailAndSucceed(AWS, emailReceiver, body, callback);
    });
};

function checkOriginOrFail(body, crypto, secret, callback) {
    const path = require('path');
    const receivedHash = path.basename(body.attach_to);
    const fqname = path.dirname(body.attach_to);

    // create SHA-256 hash of event
    let checksum = crypto.createHash('sha256');
    checksum.update(secret + fqname);
    const checkHash = checksum.digest('hex');

    if (checkHash !== receivedHash) {
        const responseBody = {
            "status": "bad request",
            "description": "not accepted"
        };
        sendResponse(callback, 400, responseBody);
    }
    return fqname;
}

function sendEmailAndSucceed(AWS, emailReceiver, body, callback) {
    const ses = new AWS.SES({
        region: 'us-east-1'
    });
    const sesParams = {
        Destination: {
            ToAddresses: [emailReceiver]
        },
        Message: {
            Body: {
                Text: {
                    Data: "Comment to " + body.attach_to + "\n\n" + body.content
                }
            },
            Subject: {
                Data: "[Andreas Manessinger] Comment from " + body.author + " <" + body.author_email + ">"
            }
        },
        Source: emailReceiver
    };
    const email = ses.sendEmail(sesParams, function (err, data) {
        if (err) {
            console.log(err);
        }
        const responseBody = {
            "status": "accepted",
            "id": data.MessageId,
        };
        sendResponse(callback, 200, responseBody);
    });
}

function sendResponse(callback, status, body) {
    const response = {
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
