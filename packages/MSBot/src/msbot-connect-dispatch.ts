/**
 * Copyright(c) Microsoft Corporation.All rights reserved.
 * Licensed under the MIT License.
 */
// tslint:disable:no-console
import { BotConfiguration, DispatchService, IConnectedService, IDispatchService, ILuisService, ServiceTypes } from 'botframework-config';
import * as chalk from 'chalk';
import * as program from 'commander';
import * as getStdin from 'get-stdin';
import * as txtfile from 'read-text-file';
import { uuidValidate } from './utils';

program.Command.prototype.unknownOption = function (flag: any) {
    console.error(chalk.default.redBright(`Unknown arguments: ${flag}`));
    showErrorHelp();
};

interface ConnectDispatchArgs extends ILuisService {
    bot: string;
    secret: string;
    stdin: boolean;
    input?: string;
    serviceIds?: string;
}

program
    .name('msbot connect dispatch')
    .description('Connect the bot to a dispatch model')
    .option('-n, --name <name>', 'name for the dispatch')
    .option('-a, --appId <appid>', 'LUID AppId for the dispatch app')
    .option('-v, --version <version>', 'version for the dispatch app, (example: 0.1)')
    .option('--authoringKey <authoringkey>', 'authoring key for using manipulating the dispatch model via the LUIS authoring API\n')
    .option('r, --region <region>', "region to use (defaults to westus)")
    .option('--subscriptionKey <subscriptionKey>', '(OPTIONAL) subscription key used for querying the dispatch model')
    .option('--serviceIds <serviceIds>', '(OPTIONAL) comma delimited list of service ids in this bot (qna or luis) to build a dispatch model over.')

    .option('-b, --bot <path>', 'path to bot file.  If omitted, local folder will look for a .bot file')
    .option('--input <jsonfile>', 'path to arguments in JSON format { id:\'\',name:\'\', ... }')
    .option('--secret <secret>', 'bot file secret password for encrypting service secrets')
    .option('--stdin', 'arguments are passed in as JSON object via stdin')
    .action((cmd, actions) => {

    });

let args = <ConnectDispatchArgs><any>program.parse(process.argv);

if (process.argv.length < 3) {
    program.help();
} else {
    if (!args.bot) {
        BotConfiguration.loadBotFromFolder(process.cwd(), args.secret)
            .then(processConnectDispatch)
            .catch((reason) => {
                console.error(chalk.default.redBright(reason.toString().split('\n')[0]));
                showErrorHelp();
            });
    } else {
        BotConfiguration.load(args.bot, args.secret)
            .then(processConnectDispatch)
            .catch((reason) => {
                console.error(chalk.default.redBright(reason.toString().split('\n')[0]));
                showErrorHelp();
            });
    }
}

async function processConnectDispatch(config: BotConfiguration): Promise<BotConfiguration> {
    args.name = args.hasOwnProperty('name') ? args.name : config.name;

    if (args.stdin) {
        Object.assign(args, JSON.parse(await getStdin()));
    }
    else if (args.input != null) {
        Object.assign(args, JSON.parse(await txtfile.read(<string>args.input)));
    }

    if (!args.hasOwnProperty('name'))
        throw new Error('Bad or missing --name');

    if (!args.appId || !uuidValidate(args.appId))
        throw new Error('bad or missing --appId');

    if (!args.version)
        throw new Error('bad or missing --version');
    args.version = args.version.toString();

    if (!args.authoringKey || !uuidValidate(args.authoringKey))
        throw new Error('bad or missing --authoringKey');

    if (args.subscriptionKey && !uuidValidate(args.subscriptionKey))
        throw new Error('bad --subscriptionKey');

    const newService = new DispatchService(<IDispatchService><any>args);

    if (!args.serviceIds) {
        // default to all services as appropriate
        const dispatchServices = <IConnectedService[]>(<any>args).services;

        if (<IConnectedService[]>dispatchServices) {
            for (let service of dispatchServices) {
                switch (service.type) {
                    case ServiceTypes.File:
                    case ServiceTypes.Luis:
                    case ServiceTypes.QnA:
                        newService.serviceIds.push(service.id || '');
                        break;
                }
            }
        }
    } else {
        newService.serviceIds = args.serviceIds.split(',');
    }

    // add the service
    let id =config.connectService(newService);
    await config.save(args.secret);
    process.stdout.write(JSON.stringify(config.findService(id), null, 2));
    return config;
}

function showErrorHelp() {
    program.outputHelp((str) => {
        console.error(str);
        return '';
    });
    process.exit(1);
}