## Setup for IITB IMAP Mailbox Test

1. In you local repo create a folder/file `./private/.env` in repo root and put the contents of `./.env.example` to it. Fill your own data in it and for our Access token see next step.
2. To generate IITB_IMAP_ACCESS_TOKEN follow [Steps to generate SSO Access Token](./Steps-to-generate-SSO-Access-Token.md)

## Setup for HuggingFace Free API

1. In you local repo create a file `requirements.txt` in repo root and put 
    ```
    beautifulsoup4
    langchain-core
    langchain-groq
    ```
2. Run this command `pip install -r requirements.txt` in your virtual environment.
3. To generate GROQ_API_KEY follow [Steps to generate Groq API Token](./Steps-to-generate-ChatGroq-API-Token.md)
