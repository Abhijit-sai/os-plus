'use client';
import {ShopifyDraftSetupForm} from '@/components/orders/shopify-draft-setup-form';
import {fictionalId as id,shopifyDraftSetupAction,searchShopifySetupOptions} from '../../mock-actions';
export default function Page(){return <ShopifyDraftSetupForm view={{tenantId:id(1),orderId:id(11),connectionId:id(2),shopGid:'gid://shopify/Shop/1',
  sourceOrderId:id(3),sourceOrderGid:'gid://shopify/Order/11',sourceRevisionId:id(4),sourceDigest:'a'.repeat(64),sourceUpdatedAt:'2026-10-19T10:00:00Z',
  setupId:null,version:0,current:true,choices:null,customerId:id(5),customers:[{id:id(5),name:'Fictional buyer'}],
  itemTypes:[{id:id(6),name:'Pant'}],workflows:[{id:id(7),name:'Pant default workflow',itemTypeId:id(6)}],sizes:[{id:id(8),name:'38',itemTypeId:id(6)}],customerSearchRequired:false}}
  lines={[{id:'gid://shopify/LineItem/1',title:'Comfortable Korean Pants',variant:'Black · 38',quantity:1}]} submitAction={shopifyDraftSetupAction} searchOptions={searchShopifySetupOptions}/>;}
