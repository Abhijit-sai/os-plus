'use client';
import {ShopifySimpleSetup} from '@/components/settings/shopify-simple-setup';
import {initialWorkspace,shopifyUnifiedAction} from '../../mock-actions';
export default function Page(){return <ShopifySimpleSetup initial={initialWorkspace()} shopDomain="fictional.myshopify.com" today="2026-10-19" submitAction={shopifyUnifiedAction}/>;}
