import { CompanyDetails, CompanyShort, DEV_BY_COMPANIES_URL, HttpStatusError } from './common.js';
import { JSDOM } from 'jsdom';

function parseName(dom: JSDOM): string {
	const document = dom.window.document;
	const header = document.querySelector('.widget-companies-header > .clearfix > .left')!;

	return header!.querySelector('h1')!.textContent as string;
}

function parseTags(dom: JSDOM): string[] {
	const document = dom.window.document;
	const header = document.querySelector('.widget-companies-header > .clearfix > .left')!;

	const tagsString = header!.querySelector('.full-name > .gray')!.textContent as string;
	return tagsString.replaceAll('\n', '').trim().split(', ');
}

function parseEmployees(dom: JSDOM): {
	total?: number;
	inBelarus?: number;
	inBelarusNonIT?: number;
} | null {
	const document = dom.window.document;
	const header = document.querySelector('.widget-companies-header > .clearfix > .left')!;
	const headerBlocks = Array.from(header!.querySelectorAll('.data-info'));

	const employeesBlock =
		headerBlocks.find((block) => block.querySelector('span.employee-count') !== null) || null;
	if (!employeesBlock) {
		return null;
	}
	const employees: ReturnType<typeof parseEmployees> = {};
	const quantityElements = employeesBlock.querySelectorAll('span.employee-count');
	for (const quantityElement of quantityElements) {
		const quantity = Number(
			quantityElement.textContent!.replaceAll('≈', '').replaceAll('=', '').trim(),
		);
		const type = quantityElement.previousElementSibling!.textContent!.trim();
		if (type === 'Сотрудники') employees['total'] = quantity;
		if (type === 'Технические специалисты в Беларуси') employees['inBelarus'] = quantity;
		if (type === 'Сотрудники в Беларуси') employees['inBelarusNonIT'] = quantity;
	}
	return employees;
}

function parseFoundationYear(dom: JSDOM): number | null {
	const document = dom.window.document;
	const header = document.querySelector('.widget-companies-header > .clearfix > .left')!;

	const headerBlocks = Array.from(header!.querySelectorAll('.data-info'));
	const foundationYearBlock =
		headerBlocks.find(
			(block) => block.textContent && block.textContent.indexOf('год основания') !== -1,
		) || null;
	if (!foundationYearBlock) {
		return null;
	}
	const yearString = foundationYearBlock.textContent!;
	const cleanYearString = yearString.replaceAll('\n', ' ').trim().split(' ')[0];
	return Number(cleanYearString);
}

function parseDescription(dom: JSDOM): string {
	const document = dom.window.document;
	const descriptionElement = document.querySelector(
		'.widget-companies-description .description>.text',
	);
	return descriptionElement!.textContent!.trim().replace(/\n+/g, '\n');
}

function parseRating(dom: JSDOM): number | null {
	const document = dom.window.document;
	const ratingElement = document.querySelector('.avg-rating');
	if (ratingElement === null) {
		return null;
	}
	return Number(ratingElement.textContent!.replaceAll('\n', '').trim());
}

function parseLegalName(dom: JSDOM): string {
	const document = dom.window.document;
	const sidebar = document.querySelector('.sidebar-for-companies')!;

	return sidebar.querySelector('.fn.org.hidden')!.textContent!.replaceAll('\n', '').trim();
}

function parseContacts(dom: JSDOM): { email: string; phone: string; website: string } {
	const document = dom.window.document;
	const sidebar = document.querySelector('.sidebar-for-companies')!;

	const contactsElements = sidebar.querySelectorAll('.sidebar-views-contacts li');
	return {
		email: contactsElements[0].querySelector('span')!.textContent!,
		phone: contactsElements[1].querySelector('span')!.textContent!,
		website: contactsElements[2].querySelector('a')!.href,
	};
}

function parseAddress(dom: JSDOM): string | null {
	const document = dom.window.document;
	const sidebar = document.querySelector('.sidebar-for-companies')!;

	const addressElement = sidebar.querySelector('.street-address');
	if (addressElement === null) {
		return null;
	}
	return addressElement.textContent!.replaceAll('\n', '');
}

function parseViews(dom: JSDOM): number {
	const document = dom.window.document;
	const sidebar = document.querySelector('.sidebar-for-companies')!;

	const viewsElement = sidebar.querySelector('.info-company-panel .icon-dev-show')!.parentElement;
	return Number(viewsElement!.textContent!.replaceAll('\n', '').trim().split(' ').at(-1));
}

function parseAgents(dom: JSDOM): Array<{
	name: string;
	link: string;
	position: string;
}> {
	const document = dom.window.document;

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

function parseWorkers(dom: JSDOM): {
	actual: Array<{ name: string; link: string }>;
	former: Array<{ name: string; link: string }>;
} {
	const document = dom.window.document;

	const workers: ReturnType<typeof parseWorkers> = {
		actual: [],
		former: [],
	};
	const actualWorkersElements = document.querySelectorAll(
		'.widget-companies-worker > ul[data-type="actual"] > li',
	);
	const formerWorkersElements = document.querySelectorAll(
		'.widget-companies-worker > ul[data-type="former"] > li',
	);
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

export async function getCompanies(): Promise<Array<CompanyShort>> {
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

export async function getCompanyDetails(companyUrl: string): Promise<CompanyDetails> {
	const page = await fetch(companyUrl);
	if (!page.ok) {
		throw new HttpStatusError(page.status, page.statusText);
	}
	const dom = new JSDOM(await page.text());
	return {
		name: parseName(dom),
		legalName: parseLegalName(dom),
		tags: parseTags(dom),
		foundationYear: parseFoundationYear(dom),
		employeesDetails: parseEmployees(dom),
		description: parseDescription(dom),
		rating: parseRating(dom),
		contacts: parseContacts(dom),
		address: parseAddress(dom),
		views: parseViews(dom),
		agents: parseAgents(dom),
		workers: parseWorkers(dom),
	};
}
