import type { SVGProps } from "react";

export const Icons = {
	yandexTrackerLogo: ({ ...props }: SVGProps<SVGSVGElement>) => (
		<svg
			aria-hidden="true"
			viewBox="0 0 16 16"
			fill="currentColor"
			stroke="none"
			{...props}
		>
			<path
				fillRule="evenodd"
				d="M2.75 2.5a.25.25 0 0 0-.25.25v2.17c0 .138.11.25.25.25h2.42V2.5zm3.92 0v2.67h2.67V2.5zm4.17 0v2.67h2.42a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25zm0 4.17h2.42A1.75 1.75 0 0 0 15 4.92V2.75A1.75 1.75 0 0 0 13.25 1H2.75A1.75 1.75 0 0 0 1 2.75v2.17c0 .966.78 1.75 1.75 1.75h2.42v6.58c0 .966.78 1.75 1.75 1.75h2.17a1.75 1.75 0 0 0 1.75-1.75zm-1.5 0H6.67v2.67h2.67zm0 4.17H6.67v2.42c0 .138.11.25.25.25h2.17a.25.25 0 0 0 .25-.25z"
				clipRule="evenodd"
			/>
		</svg>
	),
};
