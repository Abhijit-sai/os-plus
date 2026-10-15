// Publicly safe fictional UI fixture. No production tenant or customer details.
export function applicationView(){
  const tenant='10000000-0000-4000-8000-000000000001',connection='20000000-0000-4000-8000-000000000001',source='30000000-0000-4000-8000-000000000001',
    customer='40000000-0000-4000-8000-000000000001',mapping='50000000-0000-4000-8000-000000000001',itemType='60000000-0000-4000-8000-000000000001',workflow='70000000-0000-4000-8000-000000000001';
  return {shopDomain:'fictional-pilot.myshopify.com',connection:{id:connection,status:'verified',revision:2,processingEnabled:true,releaseEnabled:true,cutoff:'2026-10-13T00:00:00Z'},
    policy:{orderGid:'gid://shopify/Order/101',expiresAt:'2026-10-21T00:00:00Z',active:true,reason:'Fictional one-order acceptance test'},
    sources:[{id:source,orderId:'80000000-0000-4000-8000-000000000001',orderGid:'gid://shopify/Order/101',number:'SHOP-FICTIONAL-101',orderStatus:'draft',customerId:customer,
      revisionId:'90000000-0000-4000-8000-000000000001',sourceUpdatedAt:'2026-10-14T12:00:00Z',reviewReasons:['MAPPING_REQUIRED','DELIVERY_REVIEW_REQUIRED'],review:null,state:null,sourceStatus:'complete',customerName:'Fictional Buyer',
      lines:[{id:'gid://shopify/LineItem/1',title:'Blue cotton shirt',variantGid:'gid://shopify/ProductVariant/21',sku:'SHIRT-BLUE-M',quantity:1,colour:'Blue',size:'M'}],
      payment:{availability:'available',status:'PAID',statusLabel:'Paid',currency:'INR',presentmentCurrency:'INR',amounts:{total:'1500.00',received:'1500.00',refunded:'0.00',net:'1500.00',outstanding:'0.00'},
        presentmentAmounts:{total:'1500.00',received:'1500.00',refunded:'0.00',net:'1500.00',outstanding:'0.00'},observedAt:'2026-10-14T12:00:00Z',sourceUpdatedAt:'2026-10-14T12:00:00Z',productionHeld:false,validation:'source_consistent',reasons:[]}}],
    mappings:[{id:mapping,variantGid:'gid://shopify/ProductVariant/21',sku:'SHIRT-BLUE-M',classification:'production',itemTypeId:itemType,workflowId:workflow,standardSizeId:null,isActive:true,revision:1}],
    jobs:[{id:'a0000000-0000-4000-8000-000000000001',orderGid:'gid://shopify/Order/101',requested:1,completed:1,attempts:0,error:null,deadLetteredAt:null,nextAttemptAt:'2026-10-14T12:00:00Z',leaseExpiresAt:null,leaseActive:false}],privacy:[],
    history:[{id:'b0000000-0000-4000-8000-000000000001',action:'authorize_copy',at:'2026-10-14T12:00:00Z',reason:'Fictional one-order acceptance test',disposition:null}],
    itemTypes:[{id:itemType,name:'Shirts'}],workflows:[{id:workflow,name:'Regular stitching',itemTypeId:itemType}],sizes:[],customers:[{id:customer,name:'Fictional Buyer'}],customersTruncated:false,
    // Never passed as application authority; only preview/test metadata.
    fixtureTenant:tenant};
}
