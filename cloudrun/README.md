# scratchcard for cloudrun

Serve Scratchcard service on Cloud Run.

## Build server

```
$ npm run build
```

## Run server locally

```
$ npm run start
```

## Build and Upload image

MUST `npm run build` first.

```
$ gcloud builds submit --tag <url>
```

## Deploy image on Cloud Run

```
$ gcloud run deploy <service> --image <url> --region <region>
```