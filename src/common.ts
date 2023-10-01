export interface CompanyShort {
	name: string;
	url: string;
	rating: number | null;
	employees: number;
	reviews: number;
}

export interface CompanyDetails {
	name: string;
	legalName: string;
	tags: string[];
	foundationYear: number | null;
	employeesDetails: {
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

export interface Company extends CompanyShort, CompanyDetails {}

export type Data = Array<Company>;

export const DEV_BY_COMPANIES_URL = 'https://companies.devby.io';

export class HttpStatusError extends Error {
	constructor(public status: number, public statusText: string) {
		super(`Error ${status}: ${statusText}`);
		Object.setPrototypeOf(this, HttpStatusError.prototype);
	}
}
