interface DOCUMENTS_ENDPOINTS {
	'/v1/external.workflow-templates.lists': {
		GET: (params: { templateKey: string; roomId: string; offset?: number; count?: number }) => {
			lists: Array<{
				_id: string;
				name: string;
				description?: string;
				templateKey?: string;
				templateListId?: string;
				stageCount: number;
				itemCount: number;
				createdAt: Date;
			}>;
			count: number;
			offset: number;
			total: number;
		};
	};
	'/v1/external.workflow-templates.documents': {
		GET: (params: { templateKey: string; roomId: string; offset?: number; count?: number }) => {
			documents: Array<{
				_id: string;
				title: string;
				description?: string;
				templateKey?: string;
				templateDocumentId?: string;
				currentVersion: number;
				createdAt: Date;
				updatedAt: Date;
			}>;
			count: number;
			offset: number;
			total: number;
			roomName: string;
		};
	};
}
