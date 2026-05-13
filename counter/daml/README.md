# Counter Daml

Build the DAR:

```bash
dpm build
```

The compiled DAR is written to:

```bash
.daml/dist/quickstart-counter-0.0.1.dar
```

Deploy it to the local Canton base:

```bash
../../canton-base/scripts/deploy-dar.sh .daml/dist/quickstart-counter-0.0.1.dar
```

This folder owns the app Daml code. The base Canton folder should not keep app DARs checked in.
