// 테이블 생성 함수
async function ensureTableExists(db) {
  try {
    // 테이블이 존재하는지 확인
    const result = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='scan_data'"
    ).first();
    
    if (!result) {
      // 테이블이 없으면 생성
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS scan_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sequence INTEGER NOT NULL,
          barcode_text TEXT NOT NULL,
          scan_timestamp TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      // 인덱스 생성
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_scan_timestamp ON scan_data(scan_timestamp)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_created_at ON scan_data(created_at)').run();
      
      console.log('테이블 및 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('테이블 생성 오류:', error);
    throw error;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { data } = await request.json();
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '저장할 데이터가 없습니다.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // D1 데이터베이스에 데이터 저장
    const db = env.DB;
    
    // 테이블이 없으면 자동 생성
    await ensureTableExists(db);
    
    // 트랜잭션으로 모든 데이터 한번에 저장
    const stmt = db.prepare(
      'INSERT INTO scan_data (sequence, barcode_text, scan_timestamp) VALUES (?, ?, ?)'
    );
    
    const results = await db.batch(
      data.map(item => 
        stmt.bind(item.sequence, item.text, item.timestamp)
      )
    );

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${data.length}개의 데이터가 성공적으로 저장되었습니다!`,
      saved: results.length
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('데이터 저장 오류:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '저장 중 오류가 발생했습니다: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}