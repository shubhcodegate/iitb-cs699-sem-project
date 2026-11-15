from fastapi import FastAPI


app = FastAPI(title="Campus Pulse API")

@app.get("/health")
def health_check(): 
    return {"status" : "OK"}