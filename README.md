# AWS Lambda receiving comments from manessinger.com

A nodejs-base Lambda. It's part o fthe comment system of manessinger.com.
This Lambda receives a comment from the web component, checks if it's genuinely for an item on the blog, and if so, pushes it to an Amazon SQS queue for further processing.