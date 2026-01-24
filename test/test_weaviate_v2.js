const weaviate = require('weaviate-ts-client').default;

// --- CẤU HÌNH KẾT NỐI (Thay đổi thông tin của bạn vào đây) ---
const SCHEME = 'http'; // hoặc 'http'
const HOST = 'localhost:8080'; // ví dụ: cluster-id.weaviate.network hoặc localhost:8080
const API_KEY = ''; // Để trống '' nếu không dùng key
const INDEX_NAME = 'Vs_GENERAL'; // Tên class/index muốn test query
// Custom Headers
const CUSTOM_HEADERS = {
    'X-OpenAI-Api-Key': 'user-1762956481733-gz7jnor5k'
};
// -----------------------------------------------------------

async function testWeaviateV2() {
    console.log(`Connecting to Weaviate at ${SCHEME}://${HOST}...`);

    const clientConfig = {
        scheme: SCHEME,
        host: HOST,
        headers: CUSTOM_HEADERS
    };

    if (API_KEY) {
        clientConfig.apiKey = new weaviate.ApiKey(API_KEY);
    }

    // Khởi tạo v2 client
    const client = weaviate.client(clientConfig);

    try {
        // 1. Kiểm tra Meta thông tin (ping server)
        console.log('Fetching Weaviate meta info...');
        const meta = await client.misc.metaGetter().do();
        console.log('Weaviate Version:', meta.version);

        // 1.5 Lấy danh sách Classes (Schema)
        console.log('Fetching Schema...');
        const schema = await client.schema.getter().do();
        const classes = schema.classes.map(c => c.class);
        console.log('Available Classes:', classes.join(', '));

        if (!classes.includes(INDEX_NAME)) {
            console.error(`WARNING: Class '${INDEX_NAME}' not found in schema. Please update INDEX_NAME in the script.`);
        }

        // 2. Thử query đơn giản (Lấy 1 object từ Index)
        console.log(`Querying one object from class '${INDEX_NAME}'...`);

        const result = await client.graphql
            .get()
            .withClassName(INDEX_NAME)
            .withLimit(1)
            .withFields('_additional { id }') // Lấy ID để test
            .do();

        console.log('Query Result:', JSON.stringify(result, null, 2));

        if (result.errors) {
            console.error('Query returned errors:', result.errors);
        } else {
            console.log('SUCCESS: Connected and queried Weaviate v2 successfully!');
        }

        // 3. Thử Query Hybrid (Kết hợp Vector + Keyword)
        console.log(`Testing Hybrid Search (alpha: 0.5) on class '${INDEX_NAME}'...`);
        const hybridResult = await client.graphql
            .get()
            .withClassName(INDEX_NAME)
            .withHybrid({
                query: 'test', // Từ khóa tìm kiếm giả định
                alpha: 0.5     // 0.5 = cân bằng giữa vector và keyword
            })
            .withLimit(1)
            .withFields('_additional { id score }') // Lấy ID và score
            .do();

        console.log('Hybrid Query Result:', JSON.stringify(hybridResult, null, 2));

        if (hybridResult.errors) {
            console.error('Hybrid Query returned errors:', hybridResult.errors);
        } else {
            console.log('SUCCESS: Hybrid search executed successfully!');
        }

    } catch (error) {
        console.error('ERROR: Failed to connect or query Weaviate.');
        console.error(error);
    }
}

testWeaviateV2();
