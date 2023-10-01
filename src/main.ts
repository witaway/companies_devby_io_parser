import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as process from 'process';
import * as fs from 'fs';
import { run } from './logic.js';

const argv = await yargs(hideBin(process.argv))
	.command(
		'$0 <filename>',
		'Fetch and parse companies.devby.io !',
		(yargs) => {
			return (
				yargs
					.option('force', {
						alias: 'f',
						type: 'boolean',
						description: 'If file exist, overwrite it and remove old data',
					})
					.option('continue', {
						alias: 'c',
						type: 'boolean',
						description:
							'If file exist, keep downloaded companies and fetch only companies that are not in the it',
					})

					// Output format
					.option('full', {
						type: 'boolean',
						default: false,
						description: 'Send company information to STDOUT after successful fetch',
					})

					// Fetching options
					.option('retries-per-company', {
						alias: 'n',
						type: 'number',
						default: 10,
						description: "Number retries to fetch company if attempt isn't successful",
					})
					.option('delay-between-retries', {
						alias: 'd',
						type: 'number',
						default: 2000,
						description: 'Delay (milliseconds) between fetch retries',
					})
					.option('delay-between-companies', {
						alias: 'D',
						type: 'number',
						default: 4000,
						description: 'Delay (milliseconds) between fetching previous company and next',
					})

					// Sorting
					.option('sort', {
						type: 'boolean',
						default: false,
						description:
							'Fetch companies in sorted order (when used with --continue sorts old records before fetching new)',
					})
					.option('asc', {
						type: 'boolean',
						description: 'Ascending order of sorting',
					})
					.option('desc', {
						type: 'boolean',
						description: 'Descending order of sorting (default)',
					})
					.option('by-reviews', {
						type: 'boolean',
						description: 'Reviews number as sorting key',
					})
					.option('by-employees', {
						type: 'boolean',
						description: 'Employees number as sorting key',
					})
					.option('by-rating', {
						type: 'boolean',
						description: 'Rating as sorting key',
					})
					.option('by-name', {
						type: 'boolean',
						description: 'Name as sorting key (default)',
					})

					.conflicts('force', ['continue'])
					.conflicts('asc', ['desc'])
					.conflicts('by-employees', ['by-name', 'by-rating', 'by-reviews'])
					.conflicts('by-name', ['by-employees', 'by-rating', 'by-reviews'])
					.conflicts('by-rating', ['by-name', 'by-employees', 'by-reviews'])
					.conflicts('by-reviews', ['by-name', 'by-rating', 'by-employees'])
					.implies('asc', 'sort')
					.implies('desc', 'sort')
					.implies('by-employees', 'sort')
					.implies('by-reviews', 'sort')
					.implies('by-name', 'sort')
					.implies('by-rating', 'sort')

					.positional('filename', {
						type: 'string',
						demandOption: true,
						normalize: true,
					})

					.check((argv) => {
						if (argv['retries-per-company'] !== undefined && argv['retries-per-company'] < 0) {
							throw new Error(
								'Only non-negative number of tries is accepted (--retries-per-company >= 0)',
							);
						}
						if (
							(argv['delay-between-companies'] !== undefined &&
								argv['delay-between-companies'] < 0) ||
							(argv['delay-between-retries'] !== undefined && argv['delay-between-retries'] < 0)
						) {
							throw new Error(
								'Only non-negative time is accepted (--delay-between-companies >= 0, delay-between-retries >= 0)',
							);
						}
						return true;
					})
			);
		},
		async (yargs) => {
			run({
				outputFile: yargs.filename,
				continue: yargs.continue,
				force: yargs.force,
				delayBetweenCompanies: yargs.delayBetweenCompanies,
				delayBetweenRetries: yargs.delayBetweenRetries,
				triesPerCompany: yargs.retriesPerCompany,
				full: yargs.full,
				sort: yargs.sort
					? {
							order: yargs.desc ? 'desc' : 'asc',
							key: yargs.byRating
								? 'rating'
								: yargs.byEmployees
								? 'employees'
								: yargs.byReviews
								? 'reviews'
								: 'name',
					  }
					: undefined,
			}).catch((error: any) => {
				if (error instanceof Error) {
					console.error(`${error.name}: ${error.message}`);
				} else {
					console.error(error);
				}
				process.exit(1);
			});
		},
	)
	.help()
	.showHelpOnFail(false)
	.wrap(null).argv;
