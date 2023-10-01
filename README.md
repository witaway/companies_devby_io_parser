A simple CLI parser of the companies.dev.by site, which I wrote to make it faster and easier to search for companies that meet the necessary criteria.

Exports all data in json format.
Then you can search this JSON using JSONPath, JSONata, Lodash and so on - your choice.

TODO (unlikely):
1. Realize getting email and phone numbers - they are protected by hidden google captcha
2. Realize JSON validation from incoming file when using --continue argument.
3. fix errors when calling tsc. At the moment the program should be run through ts-node-esm.
