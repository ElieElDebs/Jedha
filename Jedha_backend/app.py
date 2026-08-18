import os

from dotenv import load_dotenv

print("Loading environment variables...")
loaded = load_dotenv("./Configuration/.env")

if loaded == False:
    print("ERROR : Environnement variables has not been loaded succesffuly ! ")
    exit()


from fastapi import FastAPI

from Routes import report

app = FastAPI()

app.include_router(report.router)


@app.get("/")
def read_root():
    """
    Main
    """
    return {
        "status": 200,
        "message": "Jedha API is running.",
        "version": {"api": "0.0.2", "name": "Jedha", "developer": "ArduiPie"},
    }
