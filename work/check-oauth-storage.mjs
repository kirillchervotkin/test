import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ydbDriverProvider } from '../dist/common/ydb/ydb.provider.js';
import { query } from '@ydbjs/query';
import { OAuthTokenYdbRepository } from '../dist/oauth/oauth-token-ydb.repository.js';
const driver=await ydbDriverProvider.useFactory();const sql=query(driver);
try {await sql.begin(async tx=>{
 const wrapped=(...args)=>tx(...args);
 wrapped.begin=async fn=>fn(tx);
 const repo=new OAuthTokenYdbRepository(wrapped);
 const userId=randomUUID();
 const token=await repo.storeToken({userId,serviceName:'polar',encryptedAccessToken:'diagnostic',ivAccess:'diagnostic',authTagAccess:'diagnostic',expiresAt:new Date(Date.now()+60000),externalUserId:'123'});
 assert.equal(token.userId,userId);
 assert.equal(token.externalUserId,'123');
 assert.equal((await repo.findAccessToken(userId,'polar')).encryptedAccessToken,'diagnostic');
 assert.equal(await repo.getExternalUserId(userId,'polar'),'123');
 console.log('PASS: store and read OAuth token using real YDB; rolling back test data');
 throw new Error('DIAGNOSTIC_ROLLBACK');
});}catch(e){let expected=false;for(let x=e;x;x=x.cause){if(x.message==='DIAGNOSTIC_ROLLBACK')expected=true;else console.log(x.name,x.message,JSON.stringify(x.issues??''));}if(!expected)process.exit(1);}
process.exit(0);
