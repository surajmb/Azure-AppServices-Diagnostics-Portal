import { Injectable } from '@angular/core';
import { Site } from '../../shared/models/site';
import { ServerFarm } from '../../shared/models/server-farm';
import { StartupInfo } from '../../shared/models/portal';

import { ResponseMessageEnvelope } from '../models/responsemessageenvelope';
import { UriElementsService, AuthService, ArmService, RBACService } from '../../shared/services';
import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/throw';

@Injectable()
export class ServerFarmDataService {
    private siteResourceId: string;

    public siteServerFarm: BehaviorSubject<ResponseMessageEnvelope<ServerFarm>> = new BehaviorSubject(null);
    public hasServerFarmAccess: BehaviorSubject<boolean> = new BehaviorSubject(null);
    public sitesInServerFarm: BehaviorSubject<Site[]> = new BehaviorSubject(null);

    private currentSite: Site;
    public hasReadAccessToServerFarm: boolean;

    private serverFarmBehaviorSubject: BehaviorSubject<ServerFarm> = new BehaviorSubject<ServerFarm>(null);

    constructor(private _armService: ArmService, private _uriElementsService: UriElementsService, private _authService: AuthService,
        private _rbacService: RBACService) {
        this._authService.getStartupInfo()
            .flatMap((startUpInfo: StartupInfo) => {
                this.siteResourceId = startUpInfo.resourceId;
                return this._armService.getResource<Site>(this.siteResourceId);
            })
            .flatMap((site: ResponseMessageEnvelope<Site>) => {
                this.currentSite = site.properties;
                return this._rbacService.hasPermission(this.currentSite.serverFarmId, [this._rbacService.readScope]);
            })
            .flatMap((hasPermission: boolean) => {
                this.hasServerFarmAccess.next(hasPermission);
                return this._armService.getResource<ServerFarm>(this.currentSite.serverFarmId);
            })
            .flatMap((serverFarm: ResponseMessageEnvelope<ServerFarm>) => {
                this.siteServerFarm.next(serverFarm);
                return this._armService.getResourceCollection<Site>(serverFarm.id + "/sites");
            })
            .subscribe((sites: ResponseMessageEnvelope<Site>[]) => {
                this.sitesInServerFarm.next(sites.map(env => env.properties));
            });
    }

    public getSiteServerFarm() {
        return this.serverFarmBehaviorSubject;
    }

    private addAdditionalProperties(serverFarm: ServerFarm): ServerFarm {
        if (serverFarm) {
            let sizeId = serverFarm.sku.name.replace(serverFarm.sku.family, '');
            switch (sizeId) {
                case '1':
                    serverFarm.additionalProperties = {
                        cores: 1,
                        ramInGB: 1.75
                    }
                    break;
                case '2':
                    serverFarm.additionalProperties = {
                        cores: 2,
                        ramInGB: 3.5
                    }
                    break;
                case '3':
                    serverFarm.additionalProperties = {
                        cores: 4,
                        ramInGB: 7
                    }
                    break;
            }

            if (serverFarm.sku.family.toLowerCase() === 'p1') {
                serverFarm.additionalProperties.cores *= 2;
                serverFarm.additionalProperties.ramInGB *= 2;
            }
        }

        return serverFarm;
    }
}