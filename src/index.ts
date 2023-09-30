import { JSDOM } from 'jsdom';
import { Low } from 'lowdb';
import chalk from 'chalk';
import { JSONFile } from 'lowdb/node';
import YAML from 'yaml';
import * as process from 'process';

const DEV_BY_COMPANIES_URL = 'https://companies.devby.io';

const config = {
	TRIES_PER_COMPANY: 10,
	DELAY_BETWEEN_RETRIES: 10000,
	DELAY_BETWEEN_COMPANIES: 5000,
	DETAILED: true,
	OUTPUT_FILE: 'companies.json',
};

interface CompanyShort {
	name: string;
	url: string;
	rating: number;
	employees: number;
	reviews: number;
}

interface CompanyDetails {
	name: string;
	legalName: string;
	tags: string[];
	foundationYear: number | null;
	employees: {
		total?: number;
		inBelarus?: number;
		inBelarusNonIT?: number;
	} | null;
	description: string;
	rating: number | null;
	contacts: {
		email: string;
		phone: string;
		website: string;
	};
	address: string | null;
	views: number;
	agents: Array<{
		name: string;
		link: string;
		position: string;
	}>;
	workers: {
		actual: Array<{ name: string; link: string }>;
		former: Array<{ name: string; link: string }>;
	};
}

interface Company extends CompanyDetails {
	url: string;
	reviews: number;
}

type Data = Array<Company>;

class HttpStatusError extends Error {
	constructor(public status: number, public statusText: string) {
		super(`Error ${status}: ${statusText}`);
		Object.setPrototypeOf(this, HttpStatusError.prototype);
	}
}

async function getCompanies(): Promise<Array<CompanyShort>> {
	const page = await fetch(DEV_BY_COMPANIES_URL);
	if (!page.ok) {
		throw new HttpStatusError(page.status, page.statusText);
	}
	const dom = new JSDOM(await page.text());
	const document = dom.window.document;
	const companyElements = document.querySelectorAll('table.companies > tbody > tr');
	const companyElementsArray = Array.from(companyElements);
	return companyElementsArray.map((companyElement) => ({
		name: companyElement.querySelectorAll('td')[0].querySelector('a')!.textContent!,
		url: DEV_BY_COMPANIES_URL + companyElement.querySelectorAll('td')[0].querySelector('a')!.href,
		rating: Number(companyElement.querySelectorAll('td')[1].getAttribute('data')),
		employees: Number(companyElement.querySelectorAll('td')[2].getAttribute('data')),
		reviews: Number(companyElement.querySelectorAll('td')[4].textContent!.replaceAll('\n', '')),
	}));
}

async function getCompanyDetails(companyUrl: string): Promise<CompanyDetails> {
	const page = await fetch(companyUrl);
	if (!page.ok) {
		throw new HttpStatusError(page.status, page.statusText);
	}
	const dom = new JSDOM(await page.text());

	const document = dom.window.document;
	const header = document.querySelector('.widget-companies-header > .clearfix > .left')!;
	const sidebar = document.querySelector('.sidebar-for-companies')!;

	function parseName(): string {
		return header!.querySelector('h1')!.textContent as string;
	}

	function parseTags(): string[] {
		const tagsString = header!.querySelector('.full-name > .gray')!.textContent as string;
		return tagsString.replaceAll('\n', '').trim().split(', ');
	}

	function parseEmployees(): {
		total?: number;
		inBelarus?: number;
		inBelarusNonIT?: number;
	} | null {
		const headerBlocks = Array.from(header!.querySelectorAll('.data-info'));
		const employeesBlock = headerBlocks.find((block) => block.querySelector('span.employee-count') !== null) || null;
		if (!employeesBlock) {
			return null;
		}
		const employees: ReturnType<typeof parseEmployees> = {};
		const quantityElements = employeesBlock.querySelectorAll('span.employee-count');
		for (const quantityElement of quantityElements) {
			const quantity = Number(quantityElement.textContent!.replaceAll('≈', '').replaceAll('=', '').trim());
			const type = quantityElement.previousElementSibling!.textContent!.trim();
			if (type === 'Сотрудники') employees['total'] = quantity;
			if (type === 'Технические специалисты в Беларуси') employees['inBelarus'] = quantity;
			if (type === 'Сотрудники в Беларуси') employees['inBelarusNonIT'] = quantity;
		}
		return employees;
	}

	function parseFoundationYear(): number | null {
		const headerBlocks = Array.from(header!.querySelectorAll('.data-info'));
		const foundationYearBlock =
			headerBlocks.find((block) => block.textContent && block.textContent.indexOf('год основания') !== -1) || null;
		if (!foundationYearBlock) {
			return null;
		}
		const yearString = foundationYearBlock.textContent!;
		const cleanYearSring = yearString.replaceAll('\n', ' ').trim().split(' ')[0];
		return Number(cleanYearSring);
	}

	function parseDescription(): string {
		const descriptionElement = document.querySelector('.widget-companies-description .description>.text');
		return descriptionElement!.textContent!.trim().replace(/\n+/g, '\n');
	}

	function parseRating(): number | null {
		const ratingElement = document.querySelector('.avg-rating');
		if (ratingElement === null) {
			return null;
		}
		return Number(ratingElement.textContent!.replaceAll('\n', '').trim());
	}

	function parseLegalName(): string {
		return sidebar.querySelector('.fn.org.hidden')!.textContent!.replaceAll('\n', '').trim();
	}

	function parseContacts(): { email: string; phone: string; website: string } {
		const contactsElements = sidebar.querySelectorAll('.sidebar-views-contacts li');
		return {
			email: contactsElements[0].querySelector('span')!.textContent!,
			phone: contactsElements[1].querySelector('span')!.textContent!,
			website: contactsElements[2].querySelector('a')!.href,
		};
	}

	function parseAddress(): string | null {
		const addressElement = sidebar.querySelector('.street-address');
		if (addressElement === null) {
			return null;
		}
		return addressElement.textContent!.replaceAll('\n', '');
	}

	function parseViews(): number {
		const viewsElement = sidebar.querySelector('.info-company-panel .icon-dev-show')!.parentElement;
		return Number(viewsElement!.textContent!.replaceAll('\n', '').trim().split(' ').at(-1));
	}

	function parseAgents(): Array<{
		name: string;
		link: string;
		position: string;
	}> {
		const agents: ReturnType<typeof parseAgents> = [];
		const agentsBlock = document.querySelector('.widget-companies-agents')!;
		const noAgent = agentsBlock.querySelector('.no-agent') !== null;
		if (noAgent) {
			return agents;
		}
		const agentsElements = agentsBlock.querySelectorAll('li');
		for (const agentElement of agentsElements) {
			agents.push({
				name: agentElement.querySelector('a')!.textContent!,
				link: agentElement.querySelector('a')!.href,
				position: agentElement.querySelector('span')!.textContent!.replaceAll('\n', '').trim(),
			});
		}
		return agents;
	}

	function parseWorkers(): {
		actual: Array<{ name: string; link: string }>;
		former: Array<{ name: string; link: string }>;
	} {
		const workers: ReturnType<typeof parseWorkers> = {
			actual: [],
			former: [],
		};
		const actualWorkersElements = document.querySelectorAll('.widget-companies-worker > ul[data-type="actual"] > li');
		const formerWorkersElements = document.querySelectorAll('.widget-companies-worker > ul[data-type="former"] > li');
		for (const workerElement of actualWorkersElements) {
			workers.actual.push({
				name: workerElement.querySelector('a')!.textContent!,
				link: workerElement.querySelector('a')!.href,
			});
		}
		for (const workerElement of formerWorkersElements) {
			workers.former.push({
				name: workerElement.querySelector('a')!.textContent!,
				link: workerElement.querySelector('a')!.href,
			});
		}
		return workers;
	}

	return {
		name: parseName(),
		legalName: parseLegalName(),
		tags: parseTags(),
		foundationYear: parseFoundationYear(),
		employees: parseEmployees(),
		description: parseDescription(),
		rating: parseRating(),
		contacts: parseContacts(),
		address: parseAddress(),
		views: parseViews(),
		agents: parseAgents(),
		workers: parseWorkers(),
	};
}

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
	console.log(process.cwd());
	// Connect to database
	const defaultData: Data = [];
	const adapter = new JSONFile<Data>(config.OUTPUT_FILE);
	const db = new Low<Data>(adapter, defaultData);

	// Fetch companies list
	const companies = await getCompanies();
	const companiesQuantity = companies.length;
	let index = 1;

	console.log(`Found ${companiesQuantity} companies\n`);
	companies.sort((ca, cb) => ca.rating - cb.rating);

	for (const { url, reviews } of companies) {
		// Log progress info
		console.log(`[${index}/${companiesQuantity}] ${url}`);
		let successful = false;
		let tries = 0;
		let companyDetails;
		// Try to fetch company TRIES_PER_COMPANY times
		while (!successful && tries < config.TRIES_PER_COMPANY) {
			try {
				companyDetails = await getCompanyDetails(url);
				successful = true;
				break;
			} catch (error: unknown) {
				if (error instanceof HttpStatusError) {
					console.error(
						chalk.red(`\t[${tries + 1}/${config.TRIES_PER_COMPANY}]. Cannot fetch ${url}.\n\t\t${error.message}`),
					);
					tries++;
					await delay(config.DELAY_BETWEEN_RETRIES);
				}
			}
		}
		// And if fetching successful, save it
		if (successful) {
			const company = { url, reviews, ...companyDetails } as Company;
			db.data.push(company);
			db.write();
			if (config.DETAILED) {
				const formatted = YAML.stringify(company, { indent: 4 }).replace(/\n+/g, '\n').replace(/^/gm, '\t');
				console.log(`\n`, formatted);
			} else {
				console.log(chalk.green(`\tSuccess`));
			}
		}
		console.log();
		await delay(config.DELAY_BETWEEN_COMPANIES);
		index++;
	}
}

void main();
