const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(bodyParser.json({ limit: "10mb" })); // Allow larger payloads for Base64 signatures
app.use(bodyParser.urlencoded({ extended: true }));

// Configure S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

// Multer configuration for handling file uploads (not used here but kept for flexibility)
const upload = multer({ storage: multer.memoryStorage() });

// API Endpoint for Upload
app.post("/upload", upload.none(), async (req, res) => {
    const { first_name, last_name, phone, emergency_contact, email, signature, children } = req.body;

    if (!signature) {
        return res.status(400).send({ message: "Signature is required." });
    }

    // Decode Base64 signature
    const base64Data = Buffer.from(signature.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const signatureFileName = `signatures/${Date.now()}_signature.png`;

    const signatureParams = {
        Bucket: process.env.AWS_BUCKET_NAME, // Replace with your bucket name
        Key: signatureFileName,
        Body: base64Data,
        ContentType: "image/png",
        ACL: "public-read", // Make the file publicly accessible
    };

    try {
        // Upload signature to S3
        const signatureUpload = await s3.upload(signatureParams).promise();
        console.log(`Signature uploaded successfully: ${signatureUpload.Location}`);

        // Parse children data
        let childrenData = [];
        if (children) {
            try {
                childrenData = JSON.parse(children); // Parse the JSON string into an array
                console.log("Children data:", childrenData);
            } catch (error) {
                return res.status(400).send({ message: "Invalid children data format.", error });
            }
        }

        // Respond with success
        res.status(200).send({
            message: "Form submitted successfully.",
            data: {
                first_name,
                last_name,
                phone,
                emergency_contact,
                email,
                signature_url: signatureUpload.Location,
                children: childrenData,
            },
        });
    } catch (error) {
        console.error("Error processing the form:", error);
        res.status(500).send({ message: "Failed to process the form.", error });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
