# zkBob Web Console

The simple tool to test and demonstrate zkBob solution possibilities 

# Running locally

Make sure you are using node js version higher or equal than `14.0.0`. The repo has been tested with `node v16.14.1` and `npm v8.5.0`

1. Clone repository and install dependencies

```bash
git clone https://github.com/zkBob/zkbob-console.git
cd zkbob-console
yarn install
```

2. Set appropriated settings in the `.env` file

3. Put circuit parameters and keys in `asset` folder. The same files should be located on relayer node

4. Run local bundle
```
yarn dev
```
5. Open your browser and enter [http://localhost:3000/](http://localhost:3000/) in the address line

It's recommended to clear your browser's history and cookies in case of you was used previous version of console

# Creating Docker container

Suppose you already done local running and set appropriated parameters and settings

1. Fix your docker ID in [this line](https://github.com/zkBob/zkbob-console/blob/0053ca2a63d00fd4be4e9bd646c05ffbdc2ecf3e/scripts/publish-docker#L4)

2. Build the prouction pack and push your container to the Docker Hub: `./scripts/publish-docker`

