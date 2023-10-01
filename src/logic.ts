import { Low } from 'lowdb';
import chalk from 'chalk';
import { JSONFile } from 'lowdb/node';
import YAML from 'yaml';
import { Company, CompanyShort, Data, HttpStatusError } from './common.js';
import { getCompanies, getCompanyDetails } from './companies.js';
import * as fs from 'fs';
import * as process from 'process';

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run(options: {
	full?: boolean;
	outputFile: string;
	force?: boolean;
	continue?: boolean;
	triesPerCompany: number;
	delayBetweenRetries: number;
	delayBetweenCompanies: number;
	sort?: {
		order: 'asc' | 'desc';
		key: 'name' | 'rating' | 'employees' | 'reviews';
	};
}): Promise<void> {
	// Connect to database
	const defaultData: Data = [];
	const adapter = new JSONFile<Data>(options.outputFile);
	const db = new Low<Data>(adapter, defaultData);

	// Connect to the file
	if (fs.existsSync(options.outputFile)) {
		if (options.force) {
			db.data = defaultData;
			db.write();
		} else if (options.continue) {
			try {
				await db.read();
			} catch (error: any) {
				throw new Error(
					`Cannot read file '${options.outputFile}'. JSON is invalid. Only forcing is available`,
				);
			}
		} else {
			throw new Error(`Cannot write file '${options.outputFile}'. Already exist`);
		}
	}

	// TODO: Check Database correctness
	// For now there might be lots of errors if we give a program file with JSON with incorrect data
	// On the other side, it's still not a long-time project
	// Everything here is a one big overkill, but you just wanted to quickly parse some data
	// And now you're trying to cover every possible case.
	// Why do you ever coded CLI for this? 150 lines file just for nothing useful
	// If you continue be so perfectionist, you're just a dumb coding wh*re.

	// Fetch companies list
	const companies = await getCompanies();
	const companiesQuantity = companies.length;
	console.log(`Found ${companiesQuantity} companies`);

	if (options.sort) {
		const compareFn = function <T extends CompanyShort>(company1: T, company2: T): number {
			const mul = options.sort!.order === 'desc' ? 1 : -1;
			const key = options.sort!.key;
			if (key === 'name') {
				return mul * company1.name.localeCompare(company2.name);
			} else {
				// || 0 - because some fields (like rating) migh be null
				return mul * ((company2[key] || 0) - (company1[key] || 0));
			}
		};
		companies.sort(compareFn);
		db.data.sort(compareFn);
		console.log('Sorting success');
	}

	let index = 0;
	for (const { url, reviews, employees } of companies) {
		index++;
		// Log progress info
		process.stdout.write(`Company [${index}/${companiesQuantity}] ${url}`);

		// Check already saved
		const urlAlreadyFetched = db.data.find((company) => company.url === url) !== undefined;
		if (urlAlreadyFetched) {
			process.stdout.write(` - ${chalk.yellow('already saved')}\n`);
			continue;
		} else {
			console.log();
		}

		let successful = false;
		let retries = 0;
		let companyDetails;
		// Try to fetch company TRIES_PER_COMPANY times
		while (!successful && retries < options.triesPerCompany) {
			try {
				companyDetails = await getCompanyDetails(url);
				successful = true;
				break;
			} catch (error: unknown) {
				if (error instanceof HttpStatusError) {
					console.error(
						chalk.red(
							`\t[${retries + 1}/${options.triesPerCompany}]. Cannot fetch ${url}.\n\t\t${
								error.message
							}`,
						),
					);
					retries++;
					await delay(options.delayBetweenRetries);
				}
			}
		}
		// And if fetching successful, save it
		if (successful) {
			const company = { url, reviews, employees, ...companyDetails } as Company;
			db.data.push(company);
			await db.write();
			if (options.full) {
				const formatted = YAML.stringify(company, { indent: 4 })
					.replace(/\n+/g, '\n')
					.replace(/^/gm, '\t');
				console.log(`\n`, formatted, '\n');
			} else {
				if (retries !== 0) {
					console.error(
						chalk.green(
							`\t[${retries + 1}/${options.triesPerCompany}]. Fetched ${url} successful.\n`,
						),
					);
				}
			}
		}
		await delay(options.delayBetweenCompanies);
	}
}
