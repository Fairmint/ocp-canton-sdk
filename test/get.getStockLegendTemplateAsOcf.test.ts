import { OcpClient } from '../src';

describe('get: getStockLegendTemplateAsOcf', () => {
  test('minimal', async () => {
    const client = new OcpClient();
    const res = await client.stockLegendTemplate.getStockLegendTemplateAsOcf({ contractId: 'slt-minimal' });
    expect(res).toEqual({
      stockLegendTemplate: {
        object_type: 'STOCK_LEGEND_TEMPLATE',
        id: 'slt-1',
        name: 'Default Legend',
        text: 'Legend text',
        comments: []
      },
      contractId: 'slt-minimal'
    });
  });

  test('full', async () => {
    const client = new OcpClient();
    const res = await client.stockLegendTemplate.getStockLegendTemplateAsOcf({ contractId: 'stock-legend-template-full' });
    expect(res).toEqual({
      stockLegendTemplate: {
        object_type: 'STOCK_LEGEND_TEMPLATE',
        id: '4c59459e-1683-4248-b7c3-ab9f46f0ccfe',
        name: 'SECURITIES ACT LEGEND',
        text: 'THE SECURITIES REPRESENTED HEREBY HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933, AS AMENDED (THE “SECURITIES ACT”), OR UNDER THE SECURITIES LAWS OF CERTAIN STATES. THESE SECURITIES ARE SUBJECT TO RESTRICTIONS ON TRANSFERABILITY AND RESALE AND MAY NOT BE TRANSFERRED OR RESOLD EXCEPT AS PERMITTED UNDER THE SECURITIES ACT AND APPLICABLE STATE SECURITIES LAWS, PURSUANT TO REGISTRATION OR EXEMPTION THEREFROM. THE ISSUER OF THESE SECURITIES MAY REQUIRE AN OPINION OF COUNSEL IN FORM AND SUBSTANCE SATISFACTORY TO THE ISSUER TO THE EFFECT THAT ANY PROPOSED TRANSFER OR RESALE IS IN COMPLIANCE WITH THE SECURITIES ACT AND ANY APPLICABLE STATE SECURITIES LAWS.\nFURTHERMORE, THE SECURITIES REPRESENTED HEREBY ARE SUBJECT TO THE TERMS AND CONDITIONS OF (1) THE ISSUER’S CERTIFICATE/ARTICLES OF INCORPORATION AND/OR BYLAWS, (2) ANY EQUITY INCENTIVE PLAN, AND (3) ANY APPLICABLE AWARD OR PURCHASE AGREEMENT, AS EACH MAY BE AMENDED FROM TIME TO TIME, COPIES OF WHICH ARE ON FILE AT THE PRINCIPAL OFFICE OF THE ISSUER.',
        comments: []
      },
      contractId: 'stock-legend-template-full'
    });
  });
});


