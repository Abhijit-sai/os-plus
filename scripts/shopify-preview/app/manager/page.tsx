'use client';
import {ShopifyDraftSetupForm} from '@/components/orders/shopify-draft-setup-form';
import {ShopifyImportedOrder} from '@/components/orders/shopify-imported-order';
import {fictionalId as id,shopifyDraftSetupAction,searchShopifySetupOptions} from '../../mock-actions';
const amounts={total:'236.00',received:'236.00',refunded:'0.00',net:'236.00',outstanding:'0.00'};
const lines=[{id:'gid://shopify/LineItem/1',title:'Fictional test pants',variant:'Black · 38',quantity:1,currentQuantity:1,sku:'TEST-PANT',
  isGiftCard:false,requiresShipping:true,unitPrice:'100.00',unitCurrency:'INR',currentLineSubtotal:'100.00',properties:[{name:'Customization',value:'Fictional test note'}],
  image:{url:'https://cdn.shopify.com/s/files/1/fictional.png',altText:'Fictional garment preview',provenance:'order' as const}},
  {id:'gid://shopify/LineItem/2',title:'Fictional test shirt',variant:'Burgundy · L',quantity:1,currentQuantity:1,sku:null,
    isGiftCard:false,requiresShipping:true,unitPrice:'100.00',unitCurrency:'INR',currentLineSubtotal:'100.00',properties:[]}];
export default function Page(){return <ShopifyImportedOrder order={{id:id(11),number:'ORD-DEMO',sourceOrderGid:'gid://shopify/Order/11',sourceNumber:'TEST-101',
  availability:'available',createdAt:'2026-10-19T10:00:00Z',updatedAt:'2026-10-19T10:00:00Z',cancelledAt:null,fulfillmentStatus:'UNFULFILLED',note:'Fictional preview only',
  customer:{name:'Fictional buyer',email:null,phone:null},shippingAddress:null,billingAddress:null,currency:'INR',subtotal:'200.00',shipping:'0.00',tax:'36.00',discount:'0.00',lines,
  payment:{availability:'available',status:'PAID',statusLabel:'Paid',currency:'INR',presentmentCurrency:'INR',amounts,presentmentAmounts:amounts,
    observedAt:'2026-10-19T10:00:00Z',sourceUpdatedAt:'2026-10-19T10:00:00Z',productionHeld:false,validation:'source_consistent',reasons:[]}}}
  setup={<ShopifyDraftSetupForm view={{tenantId:id(1),orderId:id(11),connectionId:id(2),shopGid:'gid://shopify/Shop/1',
  sourceOrderId:id(3),sourceOrderGid:'gid://shopify/Order/11',sourceRevisionId:id(4),sourceDigest:'a'.repeat(64),sourceUpdatedAt:'2026-10-19T10:00:00Z',
  setupId:null,version:0,current:true,choices:null,customerId:id(5),customers:[{id:id(5),name:'Fictional buyer'}],
  itemTypes:[{id:id(6),name:'Pant'},{id:id(16),name:'Shirt'}],workflows:[{id:id(7),name:'Pant default workflow',itemTypeId:id(6)},{id:id(17),name:'Shirt default workflow',itemTypeId:id(16)}],
  sizes:[{id:id(8),name:'38',itemTypeId:id(6)},{id:id(18),name:'L',itemTypeId:id(16)}],customerSearchRequired:false}}
  sourceCustomerName="Fictional buyer" lines={lines} submitAction={shopifyDraftSetupAction} searchOptions={searchShopifySetupOptions}/>}/>;}
