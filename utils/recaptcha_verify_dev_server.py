import click

import flask
from flask import request
from flask_cors import CORS

from urllib.parse import urlencode
from urllib.request import urlopen
import json

app = flask.Flask(__name__, static_folder='uploads')
CORS(app)


@click.command()
@click.option('--port', type=int, default=8081)
def init_app(port: int):
    app.run(host='0.0.0.0', port=port, threaded=True)


@app.route('/verify', methods=['POST'])
def verify():
    URIReCaptcha = 'https://www.google.com/recaptcha/api/siteverify'
    json_data = request.get_json()
    recaptchaResponse = json_data.get('recaptchaResponse', None)
    # special test key provided at
    # https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do
    private_recaptcha = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'
    remote_ip = request.remote_addr

    # request parameters
    params = urlencode({
        'secret': private_recaptcha,
        'response': recaptchaResponse,
        'remote_ip': remote_ip,
    })

    # actual verification request
    data = urlopen(URIReCaptcha, params.encode('utf-8')).read()

    # send back the response from Google as is
    result = json.loads(data)
    return flask.jsonify(result)


if __name__ == '__main__':
    init_app()