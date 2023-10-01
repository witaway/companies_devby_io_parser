**Simple parser for the [companies.dev.by](https://companies.dev.by)**. Coded it to make faster and easier to search for Belarus companies that meet the necessary criteria.

Exports all data in json format.

Then you can query in JSON by using `JSONPath`, `JSONata`, `Lodash` and so on - your choice.

**How to run?**
```shell
# Clone the repository
git clone git@github.com:witaway/companies_devby_io_parser.git
cd companies_devby_io_parser
# Install dependencies
npm install
# Run the CLI (--help will help you)
npm run dev:start --help
```

**What is exported?**
1. URL
2. Website link
3. Name
4. Legal name
5. Tags list
6. Description
7. Rating
8. Number of employees
9. Number of page views
10. Agents of company (their names and profiles on devby.io)
11. Former and actual workers (their names and profiles on devby.io)
12. Foundation Year
13. Head office address

**TODO (unlikely):**
1. Implement getting email and phone numbers - they are protected by hidden google captcha
2. Implement getting reviews content - for now it's not supported because reviews aren't available from Belarus
3. Implement JSON validation from incoming file when using --continue argument.
4. fix errors when calling tsc. At the moment the program should be run through ts-node-esm.
