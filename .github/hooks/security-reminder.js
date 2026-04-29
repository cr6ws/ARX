const message =
  "Security reminder: never log secrets, keep crypto in Rust, and avoid UI-backend contract changes unless requested.";

process.stdout.write(JSON.stringify({ systemMessage: message }));
