# WeChat Pay v3 Certificates

Place the following files here:

1. **`apiclient_key.pem`** — Merchant private key (商户API私钥)
   - Download from WeChat Pay Merchant Platform → API Security → API Certificate
   - Used for signing API requests and building wx.requestPayment() params

2. **`platform_cert.pem`** — WeChat Pay platform certificate (微信支付平台证书)
   - Download from WeChat Pay Merchant Platform or fetch via `/v3/certificates` API
   - Used for verifying callback notification signatures

These files are **sensitive credentials** — never commit them to git.
The `.gitignore` in this directory should exclude `*.pem` and `*.key` files.
